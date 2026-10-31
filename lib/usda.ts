import "server-only";
import type { MealContext } from "./gemini";
import { healthScore, insights, singular, tokens } from "./food-text";
import { emptyNutrients, scaleNutrients } from "./nutrition";
import type { Analysis, Nutrients } from "./schemas";

/**
 * USDA FoodData Central (public domain, CC0). https://fdc.nal.usda.gov/api-guide
 *
 * Used only when we are confident the match is right; otherwise returns null so the
 * caller falls back to the AI. Rules:
 *  - every meaningful word of the meal name must appear in the USDA description
 *  - baby food, brand-name and processed variants (powder, dehydrated…) are skipped
 *    unless the user asked for them
 *  - the portion must map to a real USDA household measure or an explicit weight;
 *    with no portion we use USDA's "Quantity not specified" (typical serving)
 */

const BASE = "https://api.nal.usda.gov/fdc/v1";
const TIMEOUT_MS = 8_000;

/** USDA nutrient numbers → our fields (values are per 100 g). */
const NUTRIENTS: Record<string, keyof Nutrients> = {
  "208": "calories",
  "203": "protein_g",
  "205": "carbs_g",
  "204": "fat_g",
  "291": "fiber_g",
  "269": "sugar_g",
  "606": "saturated_fat_g",
  "307": "sodium_mg",
  "601": "cholesterol_mg",
};

/** Variants we never pick unless the user's own words ask for them. */
const AVOID = ["babyfood", "baby", "toddler", "infant", "dehydrated", "powder", "freeze", "dried", "mix", "concentrate", "imitation"];
/** Preparation words that make a candidate less likely to be what a bare name means. */
const PREP = ["baked", "fried", "canned", "frozen", "sweetened", "candied", "glazed", "breaded", "battered", "stuffed"];
/** USDA qualifier words that don't make a description less generic ("NFS" = not further specified). */
const NEUTRAL = new Set(["nfs", "ns", "as", "to", "cooked", "raw"]);

export type UsdaFood = {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients?: { nutrientNumber?: string; value?: number }[];
  foodMeasures?: { disseminationText?: string; gramWeight?: number }[];
};

const words = tokens;

/** Brand entries in SR Legacy are written in capitals, e.g. "PIZZA HUT 12\" Pepperoni Pizza". */
const isBranded = (desc: string) => /^[A-Z][A-Z'&.\- ]{2,}\b/.test(desc) && desc.split(" ")[0] === desc.split(" ")[0].toUpperCase();

/** Match score for a candidate (higher is better), or a reason it was rejected. */
function evaluate(food: UsdaFood, query: string[]): { score: number; reason?: string } {
  const desc = words(food.description);
  const missing = query.filter((q) => !desc.includes(q));
  if (missing.length) return { score: -Infinity, reason: `missing word: ${missing.join(", ")}` };
  // USDA names the dish first ("Rice, cooked, NFS"). If that part has words the user didn't type,
  // it's a different dish: "Rice dressing", "Dirty rice", "Apple juice".
  const dish = food.description.split(",")[0];
  const foreign = words(dish).filter((w) => !query.includes(w));
  if (foreign.length) return { score: -Infinity, reason: `different dish: "${dish}"` };
  if (isBranded(food.description)) return { score: -Infinity, reason: "brand-name entry" };
  const avoided = AVOID.find((a) => desc.includes(a) && !query.includes(a));
  if (avoided) return { score: -Infinity, reason: `different form of the food (${avoided})` };
  // "Dosa, with filling" is not a plain "dosa": anything after "with" must be in the user's words.
  for (const clause of food.description.toLowerCase().matchAll(/\bwith ([^,(]+)/g)) {
    if (!words(clause[1]).every((w) => query.includes(w))) return { score: -Infinity, reason: `extra ingredient: "with ${clause[1].trim()}"` };
  }
  let s = food.dataType.startsWith("Survey") ? 3 : 0;
  if (desc.includes("nfs")) s += 4; // USDA's generic default for this food
  s -= desc.filter((w) => !query.includes(w) && !NEUTRAL.has(w)).length; // fewer extra words = closer match
  s -= 2 * PREP.filter((p) => desc.includes(p) && !query.includes(p)).length;
  return { score: s };
}

const score = (food: UsdaFood, query: string[]) => evaluate(food, query).score;

const NUMBER_WORDS: Record<string, number> = { half: 0.5, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/** Grams for the user's portion text, or null if it can't be mapped confidently. */
export function portionToGrams(portion: string | undefined, food: UsdaFood, query: string[]): { grams: number; label: string } | null {
  const measures = (food.foodMeasures ?? []).filter((m) => m.gramWeight && m.disseminationText);
  const find = (pred: (text: string) => boolean) => measures.find((m) => pred(m.disseminationText!.toLowerCase()));
  // A single-unit measure such as "1 banana", "1 egg" or "1 medium" (not "1 medium pizza (12\")").
  const unitMeasure = () =>
    find((t) => {
      const w = words(t);
      return /^1 /.test(t) && w.length === 1 && query.includes(w[0]);
    }) ??
    // USDA's generic unit, e.g. "1 piece, NFS" (not further specified), then other single units.
    find((t) => /^1 piece, nfs$/.test(t)) ??
    find((t) => /^1 (piece|medium|serving)$/.test(t));

  const text = (portion ?? "").trim().toLowerCase();
  if (!text) {
    const typical = find((t) => t.includes("quantity not specified")) ?? unitMeasure();
    // A bare name should never resolve to a family-size measure.
    const label = /quantity not specified/i.test(typical?.disseminationText ?? "") ? "Typical serving" : typical?.disseminationText;
    return typical && typical.gramWeight! <= 600 ? { grams: typical.gramWeight!, label: label! } : null;
  }

  const m = text.match(/^(\d+(?:\.\d+)?|½|¼|half|one|two|three|four|five|six)\s*(.*)$/);
  if (!m) return null;
  const qty = m[1] === "½" ? 0.5 : m[1] === "¼" ? 0.25 : (NUMBER_WORDS[m[1]] ?? Number(m[1]));
  const rest = m[2].replace(/[^a-z ]/g, " ").trim();
  if (!Number.isFinite(qty) || qty <= 0) return null;

  const weightUnits: Record<string, number> = { g: 1, gm: 1, gms: 1, gram: 1, grams: 1, kg: 1000, oz: 28.35, ounce: 28.35, ounces: 28.35, ml: 1 };
  const unit = rest.split(" ")[0];
  if (unit in weightUnits) return { grams: qty * weightUnits[unit], label: `${qty} ${unit}` };
  if (qty > 20) return null; // "40 slices" is almost certainly a typo

  // "2", "2 pcs", "2 pieces", "2 eggs" → the food's own unit measure
  if (!rest || /^(pc|pcs|piece|pieces|nos|no|unit|units)$/.test(rest) || query.includes(singular(unit))) {
    const um = unitMeasure();
    return um ? { grams: qty * um.gramWeight!, label: `${qty} × ${um.disseminationText}` } : null;
  }

  // "1 cup", "2 slices", "1 large" → matching household measure
  const wanted = words(rest);
  // Prefer "1 cup, cooked" over "1 cup, dry, yields", then the shortest wording.
  const hm = measures
    .filter((m) => wanted.length > 0 && wanted.every((w) => words(m.disseminationText!).includes(w)))
    .sort((a, b) => Number(/dry|yields/i.test(a.disseminationText!)) - Number(/dry|yields/i.test(b.disseminationText!)) || a.disseminationText!.length - b.disseminationText!.length)[0];
  if (hm) return { grams: qty * hm.gramWeight!, label: `${qty} × ${hm.disseminationText}` };

  // Drinks are measured in fluid ounces: 1 cup or glass = 8 fl oz.
  if (wanted.length === 1 && (wanted[0] === "cup" || wanted[0] === "glass")) {
    // "with ice" measures assume part of the glass is ice, so prefer the no-ice weight.
    const floz = find((t) => t === "1 fl oz (no ice)") ?? find((t) => t === "1 fl oz (nfs)") ?? find((t) => t === "1 fl oz");
    if (floz) return { grams: qty * 8 * floz.gramWeight!, label: `${qty} ${wanted[0]} (${qty * 8} fl oz)` };
  }

  // USDA writes slices of pizza, cake, etc. as "pieces"
  if (wanted.length === 1 && wanted[0] === "slice") {
    const piece = find((t) => /^1 piece, nfs$/.test(t)) ?? find((t) => /^1 piece\b/.test(t));
    if (piece) return { grams: qty * piece.gramWeight!, label: `${qty} × ${piece.disseminationText}` };
  }
  return null;
}

/** After a 429, skip USDA until this time so each meal doesn't wait on a request we know will fail. */
let rateLimitedUntil = 0;

type SearchResult = {
  foods: UsdaFood[];
  status: number;
  latencyMs: number;
  totalHits: number | null;
  rateLimit: { limit: string | null; remaining: string | null };
};

async function searchRaw(query: string): Promise<SearchResult> {
  const started = Date.now();
  const res = await fetch(`${BASE}/foods/search?api_key=${encodeURIComponent(process.env.USDA_API_KEY || "DEMO_KEY")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, dataType: ["Survey (FNDDS)", "SR Legacy"], pageSize: 50, requireAllWords: true }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const meta = {
    status: res.status,
    latencyMs: Date.now() - started,
    rateLimit: { limit: res.headers.get("x-ratelimit-limit"), remaining: res.headers.get("x-ratelimit-remaining") },
  };
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after")) || 3600;
    rateLimitedUntil = Date.now() + retryAfter * 1000;
  }
  if (!res.ok) return { ...meta, foods: [], totalHits: null };
  const json = (await res.json()) as { foods?: UsdaFood[]; totalHits?: number };
  return { ...meta, foods: json.foods ?? [], totalHits: json.totalHits ?? null };
}

async function search(query: string): Promise<UsdaFood[]> {
  const r = await searchRaw(query);
  if (r.status === 429) {
    throw new Error(
      process.env.USDA_API_KEY
        ? "USDA rate limit reached; using AI until it resets"
        : "USDA DEMO_KEY limit reached (30/hour). Set USDA_API_KEY for 1,000/hour; using AI until it resets",
    );
  }
  if (r.status !== 200) throw new Error(`USDA ${r.status}`);
  return r.foods;
}

/** Picks the best confident match from USDA search results, or null. Pure (no network) so it can be tested. */
export function pickUsdaMatch(foods: UsdaFood[], ctx: MealContext): Analysis | null {
  const query = words(ctx.name ?? "");
  const ranked = foods
    .map((f) => ({ f, s: score(f, query) }))
    .filter((x) => x.s > -Infinity)
    .sort((a, b) => b.s - a.s);

  for (const { f } of ranked.slice(0, 5)) {
    const per100 = emptyNutrients();
    let hasEnergy = false;
    for (const n of f.foodNutrients ?? []) {
      const key = n.nutrientNumber && NUTRIENTS[n.nutrientNumber];
      if (key && typeof n.value === "number") {
        per100[key] = n.value;
        if (key === "calories") hasEnergy = true;
      }
    }
    if (!hasEnergy) continue;

    const portion = portionToGrams(ctx.portion, f, query);
    if (!portion || portion.grams <= 0 || portion.grams > 3000) continue;

    const totals = scaleNutrients(per100, portion.grams / 100);
    return {
      is_food: true,
      meal_name: ctx.name ?? f.description,
      items: [{ ...totals, name: f.description, portion: portion.label, grams: Math.round(portion.grams) }],
      totals,
      health_score: healthScore(totals),
      confidence: 0.8,
      insights: insights(totals),
    };
  }
  return null;
}

/** Confident USDA estimate for a single named food, or null to fall back to the AI. */
export async function lookupUsda(ctx: MealContext): Promise<Analysis | null> {
  if (ctx.notes) return null; // notes like "cooked in ghee" change the numbers; let the AI handle them
  const query = words(ctx.name ?? "");
  if (!query.length || query.length > 5) return null;
  if (Date.now() < rateLimitedUntil) return null;

  try {
    return pickUsdaMatch(await search(query.join(" ")), ctx);
  } catch (err) {
    console.warn("usda search failed", (err as Error).message);
    return null;
  }
}

/** Admin diagnostics: the raw USDA response plus why each candidate was accepted or rejected. Ignores the backoff. */
export async function debugUsda(ctx: MealContext) {
  const query = words(ctx.name ?? "");
  let skipped = ctx.notes ? "Notes are set, so the app skips USDA and uses AI." : !query.length ? "No usable words in the name." : null;
  // Network errors (offline, DNS, timeout) are reported instead of failing the whole test
  const result = query.length
    ? await searchRaw(query.join(" ")).catch((err: Error) => {
        skipped = `USDA request failed: ${(err.cause as Error | undefined)?.message ?? err.message}. The app would skip USDA.`;
        return null;
      })
    : null;
  const candidates = (result?.foods ?? []).slice(0, 15).map((f) => {
    const ev = evaluate(f, query);
    const kcal = f.foodNutrients?.find((n) => n.nutrientNumber === "208")?.value ?? null;
    const portion = ev.score > -Infinity ? portionToGrams(ctx.portion, f, query) : null;
    return {
      fdcId: f.fdcId,
      description: f.description,
      dataType: f.dataType,
      kcalPer100g: kcal,
      measures: (f.foodMeasures ?? []).slice(0, 4).map((m) => `${m.disseminationText} = ${m.gramWeight} g`),
      score: ev.score === -Infinity ? null : ev.score,
      verdict: ev.reason ?? (kcal === null ? "no calorie data" : portion ? `ok · ${portion.label} = ${Math.round(portion.grams)} g` : "portion can't be mapped"),
    };
  });
  return {
    keyInUse: process.env.USDA_API_KEY ? "USDA_API_KEY" : "DEMO_KEY (30 requests/hour)",
    backoffActive: Date.now() < rateLimitedUntil,
    query: query.join(" "),
    skipped,
    http: result && { status: result.status, latencyMs: result.latencyMs, totalHits: result.totalHits, rateLimit: result.rateLimit },
    candidates,
    match: !ctx.notes && result ? pickUsdaMatch(result.foods, ctx) : null,
  };
}
