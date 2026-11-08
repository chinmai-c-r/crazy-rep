/**
 * Enriches analysis_cache (the single source of truth for meal nutrition) and embeds every row
 * for vector search. Safe to re-run: existing rows are skipped unless --force.
 *
 *   npm run cache:enrich                              # seed + nutrition + embed (default)
 *   npm run cache:enrich -- --steps generate --target 10000
 *   npm run cache:enrich -- --steps nutrition --limit 500 --rpm 10 --batch 40
 *   npm run cache:enrich -- --steps embed                  # only (re-)embed rows missing embeddings
 *   npm run cache:enrich -- --models gemini-3.1-flash-lite,gemini-2.5-flash-lite
 *   npm run cache:enrich -- --dry-run
 *
 * Embeddings use lib/embeddings.ts: the app embeds user searches with the same model at runtime,
 * and vectors from different models can't be compared.
 *
 * Steps
 *   seed       INDB dishes + IFCT foods from data/indian-foods.json (real lab/recipe data, no AI)
 *   generate   ask Gemini for more regional Indian dish names until the catalog reaches --target
 *   nutrition  Gemini estimates nutrition for catalog dishes that aren't cached yet (batched)
 *   embed      embed every row without an embedding (gemini-embedding-001, 768 dims)
 *
 * Inputs: data/indian-foods.json, data/dish-catalog.json, data/dish-catalog.generated.json
 * Needs .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, GEMINI_API_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import WebSocket from "ws";
import { embedTexts, toVector } from "../lib/embeddings";
import { buildAnalysis, cacheKey, insights, healthScore } from "../lib/food-text";
import { getAI, isRetryable, MODELS, thinkingFor } from "../lib/gemini";
import { emptyNutrients } from "../lib/nutrition";
import type { Analysis, Nutrients } from "../lib/schemas";

// ─── Setup ──────────────────────────────────────────────────

try {
  process.loadEnvFile(".env.local");
} catch {
  /* rely on the environment */
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};

const STEPS = opt("steps", "seed,nutrition,embed").split(",").map((s) => s.trim());
const LIMIT = Number(opt("limit", "100000"));
const BATCH = Math.min(60, Math.max(5, Number(opt("batch", "40"))));
/** Batches in flight at once; calls are still paced by --rpm. */
const CONCURRENCY = Math.min(8, Math.max(1, Number(opt("concurrency", "2"))));
const RPM = Math.max(1, Number(opt("rpm", "10")));
const TARGET = Number(opt("target", "10000"));
const FORCE = flag("force");
const DRY = flag("dry-run");
/** Each model has its own free quota, so the script can use more models than the app does. */
const SCRIPT_MODELS = [
  ...new Set(
    opt("models", "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
      .concat(opt("models", "") ? [] : [...MODELS, "gemini-3.5-flash-lite", "gemini-2.5-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest"]),
  ),
];

const ROOT = process.cwd();
const DATA = (f: string) => join(ROOT, "data", f);
const GENERATED_FILE = DATA("dish-catalog.generated.json");

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "GEMINI_API_KEY"]) {
  if (!process.env[key]) throw new Error(`Missing ${key} (set it in .env.local)`);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket as never }, // Node 20 has no global WebSocket; realtime isn't used here
});

const log = (...m: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...m);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Spaces out AI calls to respect the free-tier requests-per-minute limit. */
let lastCall = 0;
async function throttle() {
  const wait = lastCall + 60_000 / RPM - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
}

class QuotaExhausted extends Error {}

/** Reads Google's quota error: which limit was hit (per minute or per day) and how long to wait. */
function quotaInfo(err: unknown) {
  const status = (err as { status?: number }).status;
  const msg = (err as Error).message ?? "";
  if (status !== 429 && !/RESOURCE_EXHAUSTED|exceeded your current quota/i.test(msg)) return null;
  let quotaId = "";
  let limit: string | number | undefined;
  let retryMs = 60_000;
  try {
    const details = (JSON.parse(msg.slice(msg.indexOf("{"))) as { error?: { details?: Record<string, unknown>[] } }).error?.details ?? [];
    for (const d of details) {
      const violation = (d.violations as { quotaId?: string; quotaValue?: string }[] | undefined)?.[0];
      if (violation) [quotaId, limit] = [violation.quotaId ?? "", violation.quotaValue];
      if (typeof d.retryDelay === "string") retryMs = (parseFloat(d.retryDelay) || 60) * 1000 + 1000;
    }
  } catch {
    /* message wasn't JSON; fall back to text checks */
  }
  const perDay = /PerDay/i.test(quotaId) || /per ?day|daily/i.test(msg);
  return { perDay, limit, retryMs, quotaId };
}

/** Models whose daily quota is used up (or that aren't available) for the rest of this run. */
const exhausted = new Set<string>();

/** One JSON generation call on Gemini with model fallback and quota handling. */
async function generateJson<T>(prompt: string, schema: object): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt++) {
    let waitMs = 30_000 * (attempt + 1);
    const available = SCRIPT_MODELS.filter((m) => !exhausted.has(m));
    if (!available.length) throw new QuotaExhausted(`daily quota used up on all models (${SCRIPT_MODELS.join(", ")})`);
    for (const model of available) {
      await throttle();
      try {
        const res = await getAI().models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: schema,
            temperature: 0.3,
            thinkingConfig: thinkingFor(model),
            abortSignal: AbortSignal.timeout(90_000),
          },
        });
        if (!res.text) throw Object.assign(new Error("empty response"), { status: 502 });
        return JSON.parse(res.text) as T;
      } catch (err) {
        const quota = quotaInfo(err);
        const status = (err as { status?: number }).status;
        if (quota?.perDay) {
          exhausted.add(model);
          log(`  ${model}: daily free quota used up${quota.limit ? ` (${quota.limit} requests/day)` : ""}; switching model`);
        } else if (quota) {
          waitMs = Math.min(waitMs, quota.retryMs);
          log(`  ${model}: per-minute limit hit; trying next model`);
        } else if (status === 404) {
          exhausted.add(model);
          log(`  ${model}: not available to this key; skipping`);
        } else if (isRetryable(err)) {
          log(`  ${model} busy (${status ?? (err as Error).name}), trying next`);
        } else {
          throw err;
        }
      }
    }
    if (SCRIPT_MODELS.every((m) => exhausted.has(m))) throw new QuotaExhausted(`daily quota used up on all models (${SCRIPT_MODELS.join(", ")})`);
    log(`  all available models busy; waiting ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
  }
  throw new Error("AI unavailable after retries");
}

// ─── Cache helpers ──────────────────────────────────────────

type CacheRow = {
  cache_key: string;
  name: string;
  portion: null;
  notes: null;
  analysis: Analysis;
  model: string;
  source: "indb" | "ifct" | "ai-catalog";
  search_text: string;
  cuisine: string | null;
  serving_g: number;
};

async function existingKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("analysis_cache").select("cache_key").range(from, from + 999);
    if (error) throw new Error(`Reading analysis_cache failed: ${error.message}. Did you run npm run db:push?`);
    data.forEach((r) => keys.add(r.cache_key));
    if (data.length < 1000) break;
  }
  return keys;
}

async function upsertRows(rows: CacheRow[]) {
  if (DRY || !rows.length) return;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("analysis_cache").upsert(rows.slice(i, i + 500), { onConflict: "cache_key", ignoreDuplicates: !FORCE });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
  }
}

const searchText = (name: string, aliases: string[] = []) => (aliases.length ? `${name} (${aliases.join(", ")})` : name);

// ─── Step: seed (INDB + IFCT, no AI) ────────────────────────

type IndbFood = { name: string; aliases: string[]; per100: Nutrients; serving_unit: string | null; serving_g: number | null };
type IfctFood = { name: string; group: string; aliases: string[]; per100: Nutrients };

/** Plausible gram range per serving unit; INDB servings outside it fall back to 100 g. */
const RANGE: Record<string, [number, number]> = { bowl: [80, 400], plate: [100, 500], glass: [150, 450], cup: [80, 300], tablespoon: [5, 30], teaspoon: [2, 10] };
const IFCT_GROUPS = new Set(["Fruits", "Milk and Milk Products", "Edible Oils and Fats", "Nuts and Oil Seeds", "Sugars"]);

/** "Mutton biryani/biriyani (Gosht biryani)" → display "Mutton biryani", aliases ["Mutton biriyani", "Gosht biryani"]. */
function splitName(name: string) {
  const parens = [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim()).filter(Boolean);
  const main = name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const variants = main.includes("/") && !main.split("/").every((p) => p.trim().includes(" "))
    ? main.split(" ").reduce<string[]>((acc, tok) => acc.flatMap((a) => tok.split("/").map((o) => `${a} ${o}`.trim())), [""])
    : main.split("/").map((s) => s.trim());
  return { display: variants[0], aliases: [...new Set([...variants.slice(1), ...parens.flatMap((p) => p.split("/").map((s) => s.trim()))])].filter(Boolean) };
}

async function seed(existing: Set<string>) {
  const data = JSON.parse(readFileSync(DATA("indian-foods.json"), "utf8")) as { indb: IndbFood[]; ifct: IfctFood[] };
  const rows: CacheRow[] = [];

  for (const f of data.indb) {
    const { display, aliases } = splitName(f.name);
    const key = cacheKey({ name: display });
    if (!FORCE && existing.has(key)) continue;
    const unit = f.serving_unit?.split(" ").pop() ?? "";
    const [lo, hi] = RANGE[unit] ?? [10, 300];
    const trusted = f.serving_g && f.serving_unit && f.serving_g >= lo && f.serving_g <= hi;
    const grams = trusted ? f.serving_g! : 100;
    const label = trusted ? `1 ${f.serving_unit} (≈${Math.round(grams)} g)` : "100 g";
    rows.push({
      cache_key: key, name: display, portion: null, notes: null, model: "indb", source: "indb", cuisine: "Indian",
      search_text: searchText(display, [...aliases, ...f.aliases]),
      serving_g: Math.round(grams),
      analysis: buildAnalysis({ mealName: display, foodName: display, per100: f.per100, grams, portionLabel: label, confidence: 0.75 }),
    });
    existing.add(key);
  }

  for (const f of data.ifct.filter((x) => IFCT_GROUPS.has(x.group))) {
    const key = cacheKey({ name: f.name });
    if (!FORCE && existing.has(key)) continue;
    rows.push({
      cache_key: key, name: f.name, portion: null, notes: null, model: "ifct2017", source: "ifct", cuisine: "Indian",
      search_text: searchText(f.name, f.aliases),
      serving_g: 100,
      analysis: buildAnalysis({ mealName: f.name, foodName: f.name, per100: f.per100, grams: 100, portionLabel: "100 g", confidence: 0.8 }),
    });
    existing.add(key);
  }

  log(`seed: ${rows.length} new rows (INDB + IFCT)${DRY ? " [dry run]" : ""}`);
  await upsertRows(rows);
}

// ─── Catalog ────────────────────────────────────────────────

type Dish = { name: string; aliases: string[]; cuisine: string | null; course: string | null; indian: boolean; sources: string[] };

function loadCatalog(): Dish[] {
  const base = (JSON.parse(readFileSync(DATA("dish-catalog.json"), "utf8")) as { dishes: Dish[] }).dishes;
  const extra = existsSync(GENERATED_FILE) ? (JSON.parse(readFileSync(GENERATED_FILE, "utf8")) as { dishes: Dish[] }).dishes : [];
  return [...base, ...extra];
}

const dedupeKey = (name: string) =>
  name.toLowerCase().split(/[^a-z]+/).filter((w) => w && !["and", "with", "the", "a", "of", "in", "recipe"].includes(w)).map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w)).sort().join(" ");

// ─── Step: generate (more dish names) ───────────────────────

const REGIONS = [
  "Punjabi", "Kashmiri", "Himachali", "Uttarakhandi", "Haryanvi", "Rajasthani", "Gujarati", "Kathiawadi", "Sindhi", "Maharashtrian",
  "Malvani", "Goan", "Konkani", "Mangalorean", "Udupi", "Karnataka", "Coorgi", "Kerala", "Tamil Nadu", "Chettinad",
  "Andhra", "Telangana", "Hyderabadi", "Odia", "Bengali", "Bihari", "Uttar Pradesh", "Awadhi", "Mughlai", "Madhya Pradesh",
  "Chhattisgarhi", "Jharkhandi", "Assamese", "Manipuri", "Naga", "Meghalaya", "Mizo", "Tripuri", "Sikkimese", "Parsi",
  "Bohri", "Anglo-Indian", "Indo-Chinese", "Mumbai street food", "Delhi street food", "Kolkata street food", "South Indian tiffin",
];
const COURSES = [
  "breakfast dishes", "vegetarian curries and sabzis", "non-vegetarian curries", "breads and rice dishes", "snacks and street food",
  "sweets and desserts", "drinks and beverages", "dals, chutneys and sides",
];

async function generate(catalog: Dish[]) {
  const seen = new Set(catalog.map((d) => dedupeKey(d.name)));
  const indianCount = () => catalog.filter((d) => d.indian).length;
  const generated: Dish[] = existsSync(GENERATED_FILE) ? (JSON.parse(readFileSync(GENERATED_FILE, "utf8")) as { dishes: Dish[] }).dishes : [];
  log(`generate: ${indianCount()} Indian dishes in catalog, target ${TARGET}`);

  const schema = { type: "array", items: { type: "string" } };
  for (const region of REGIONS) {
    for (const course of COURSES) {
      if (indianCount() >= TARGET) break;
      const prompt = `List 40 distinct, commonly eaten ${region} ${course} as they are usually named in India (English transliteration). One dish per item, no descriptions, no duplicates, no generic categories.`;
      let names: string[];
      try {
        names = await generateJson<string[]>(prompt, schema);
      } catch (err) {
        if (err instanceof QuotaExhausted) throw err;
        log(`  ${region} / ${course}: skipped (${(err as Error).message})`);
        continue;
      }
      let added = 0;
      for (const raw of names) {
        const name = String(raw).replace(/\s+/g, " ").trim();
        const key = dedupeKey(name);
        if (name.length < 3 || name.length > 60 || !key || seen.has(key)) continue;
        seen.add(key);
        const dish: Dish = { name, aliases: [], cuisine: region, course, indian: true, sources: ["ai-generated"] };
        catalog.push(dish);
        generated.push(dish);
        added++;
      }
      log(`  ${region} / ${course}: +${added} (Indian total ${indianCount()})`);
      if (!DRY) writeFileSync(GENERATED_FILE, JSON.stringify({ note: "AI-generated dish names; nutrition is estimated by AI.", dishes: generated }, null, 0));
    }
  }
}

// ─── Step: nutrition (AI estimates for catalog dishes) ──────

/**
 * Compact output: short keys and a dish number instead of the name. Output tokens are what a
 * model spends most of its time on, so this is roughly 3x faster than long field names.
 */
const COMPACT: Record<string, keyof Nutrients> = {
  k: "calories", p: "protein_g", c: "carbs_g", f: "fat_g", fb: "fiber_g",
  su: "sugar_g", sf: "saturated_fat_g", na: "sodium_mg", ch: "cholesterol_mg",
};
const BATCH_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      i: { type: "integer" },
      s: { type: "string" },
      g: { type: "number" },
      ...Object.fromEntries(Object.keys(COMPACT).map((k) => [k, { type: "number" }])),
      h: { type: "integer" },
    },
    required: ["i", "s", "g", ...Object.keys(COMPACT), "h"],
  },
};

const num = (v: unknown) => Math.max(0, Math.round((Number(v) || 0) * 10) / 10);

function nutritionPrompt(batch: Dish[]) {
  const list = batch
    .map((d, j) => `${j + 1}. ${d.name}${d.aliases.length ? ` (also called ${d.aliases.slice(0, 2).join(", ")})` : ""}${d.cuisine ? ` [${d.cuisine}${d.course ? `, ${d.course}` : ""}]` : ""}`)
    .join("\n");
  return `You are a registered dietitian specialising in Indian and international home cooking.
For each dish below, estimate ONE typical home-style serving as commonly eaten in India, including usual cooking oil or ghee.
Use standard references (IFCT 2017, INDB, USDA).
Return a JSON array with one object per dish using these short keys:
i=dish number, s=serving (max 4 words, e.g. "1 bowl", "2 pieces"), g=grams, k=kcal, p=protein g, c=carbs g, f=fat g,
fb=fiber g, su=sugar g, sf=saturated fat g, na=sodium mg, ch=cholesterol mg, h=health score 1-10.
Use whole numbers or one decimal.

${list}`;
}

/** Turns one compact result into a cache row, or null if the estimate is obviously broken. */
function toRow(dish: Dish, r: Record<string, unknown>): CacheRow | null {
  const grams = num(r.g);
  const totals = emptyNutrients();
  for (const [short, key] of Object.entries(COMPACT)) totals[key] = num(r[short]);
  if (!grams || !totals.calories || totals.calories > 3000) return null;
  const analysis: Analysis = {
    is_food: true,
    meal_name: dish.name,
    items: [{ ...totals, name: dish.name, portion: String(r.s || "1 serving").slice(0, 60), grams: Math.round(grams) }],
    totals,
    health_score: Math.min(10, Math.max(1, Math.round(Number(r.h) || healthScore(totals)))),
    confidence: 0.6,
    insights: insights(totals),
  };
  return {
    cache_key: cacheKey({ name: dish.name }),
    name: dish.name,
    portion: null,
    notes: null,
    model: "catalog-ai",
    source: "ai-catalog",
    search_text: searchText(dish.name, dish.aliases),
    cuisine: dish.cuisine,
    serving_g: Math.round(grams),
    analysis,
  };
}

async function nutrition(catalog: Dish[], existing: Set<string>) {
  const todo = catalog
    .filter((d) => FORCE || !existing.has(cacheKey({ name: d.name })))
    .sort((a, b) => Number(b.indian) - Number(a.indian))
    .slice(0, LIMIT);
  const batches: Dish[][] = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
  log(
    `nutrition: ${todo.length} dishes in ${batches.length} batches of ${BATCH} · ${CONCURRENCY} at a time · ${RPM} calls/min`,
  );
  if (DRY) return;

  let saved = 0;
  let done = 0;
  let next = 0;
  let stop: unknown = null;
  const started = Date.now();

  // A small worker pool: each worker takes the next batch until none are left (or the quota runs out)
  const worker = async () => {
    while (!stop && next < batches.length) {
      const index = next++;
      const batch = batches[index];
      let results: Record<string, unknown>[];
      try {
        results = await generateJson<Record<string, unknown>[]>(nutritionPrompt(batch), BATCH_SCHEMA);
      } catch (err) {
        if (err instanceof QuotaExhausted) {
          stop = err;
          return;
        }
        done++;
        log(`  batch ${index + 1}/${batches.length}: skipped (${(err as Error).message.slice(0, 120)})`);
        continue;
      }
      const rows = batch
        .map((dish, j) => {
          const r = results.find((x) => Number(x.i) === j + 1) ?? results[j];
          return r ? toRow(dish, r) : null;
        })
        .filter((r): r is CacheRow => r !== null);
      await upsertRows(rows);
      rows.forEach((r) => existing.add(r.cache_key));
      saved += rows.length;
      done++;
      const perMin = (saved / ((Date.now() - started) / 60_000)).toFixed(0);
      const etaMin = Math.round(((batches.length - done) * BATCH) / Math.max(1, Number(perMin)));
      log(`  batch ${index + 1}/${batches.length}: saved ${rows.length}/${batch.length} · total ${saved} · ${perMin} dishes/min · ~${etaMin} min left`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
  if (stop) throw stop;
}

// ─── Step: embed ────────────────────────────────────────────

/** The free embedding quota counts each text, so send small batches and wait out per-minute limits. */
const EMBED_BATCH = Math.min(100, Math.max(10, Number(opt("embed-batch", "50"))));

async function embedWithQuota(texts: string[]) {
  for (let attempt = 0; attempt < 15; attempt++) {
    await throttle();
    try {
      return await embedTexts(texts, "RETRIEVAL_DOCUMENT", { retries: 0 });
    } catch (err) {
      const quota = quotaInfo(err);
      if (quota?.perDay) throw new QuotaExhausted(`embedding daily quota used up${quota.limit ? ` (${quota.limit}/day)` : ""}`);
      if (!quota && !isRetryable(err)) throw err;
      const wait = quota?.retryMs ?? 15_000 * (attempt + 1);
      log(`  embeddings ${quota ? "per-minute limit" : "busy"}; waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
  throw new Error("Embedding unavailable after retries");
}

async function embed() {
  let total = 0;
  for (;;) {
    const { data, error } = await db.from("analysis_cache").select("cache_key, name, search_text, embed_text").or("embedding.is.null,embedded_at.is.null").limit(500);
    if (error) throw new Error(`Reading rows to embed failed: ${error.message}`);
    if (!data.length) break;
    if (DRY) {
      log(`embed: ${data.length}+ rows need embeddings [dry run]`);
      return;
    }
    for (let i = 0; i < data.length; i += EMBED_BATCH) {
      const chunk = data.slice(i, i + EMBED_BATCH);
      const vectors = await embedWithQuota(chunk.map((r) => r.embed_text || r.search_text || r.name));
      const { error: setError } = await db.rpc("set_cache_embeddings", {
        p_rows: chunk.map((r, j) => ({ cache_key: r.cache_key, embedding: toVector(vectors[j]) })),
      });
      if (setError) throw new Error(`Saving embeddings failed: ${setError.message}`);
      total += chunk.length;
      log(`  embedded ${total}`);
    }
  }
  log(`embed: done (${total} rows)`);
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  log(`steps: ${STEPS.join(", ")}${DRY ? " · dry run" : ""}${FORCE ? " · force" : ""} · models: ${SCRIPT_MODELS.join(", ")}`);
  const existing = await existingKeys();
  log(`analysis_cache has ${existing.size} rows`);
  const catalog = loadCatalog();
  log(`catalog: ${catalog.length} dishes (${catalog.filter((d) => d.indian).length} Indian)`);

  try {
    if (STEPS.includes("seed")) await seed(existing);
    if (STEPS.includes("generate")) await generate(catalog);
    if (STEPS.includes("nutrition")) await nutrition(catalog, existing);
  } catch (err) {
    if (!(err instanceof QuotaExhausted)) throw err;
    log(`Daily AI quota reached; stopping here. Re-run tomorrow to continue (finished work is saved). ${err.message}`);
  }
  if (STEPS.includes("embed")) {
    try {
      await embed();
    } catch (err) {
      if (!(err instanceof QuotaExhausted)) throw err;
      log(`${err.message}; re-run later to finish embedding (finished rows are saved).`);
    }
  }
  log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
