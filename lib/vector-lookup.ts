import "server-only";
import { embedTexts, toVector } from "./embeddings";
import { coversQuery, keyIngredientClash, parsePortion, scaleAnalysis, singular, tokens, type Portion } from "./food-text";
import type { MealContext } from "./gemini";
import { analysisSchema, type Analysis } from "./schemas";
import { createAdmin } from "./supabase/server";

/**
 * Hybrid search over analysis_cache: pgvector finds the nearest dishes, then word checks decide.
 * Calibrated on gemini-embedding-001 (768 dims): correct matches score ~0.72–0.78, but wrong
 * dishes can score 0.71 (mutton vs chicken biryani), so similarity alone is never enough.
 */
const MIN_SIMILARITY = 0.7;
const AMBIGUITY_MARGIN = 0.02;

export type CacheSource = "ai" | "usda" | "indb" | "ifct" | "ai-catalog";
/** similarity is null for rows found by text search only (they must match a name exactly to be used). */
type Row = { cache_key: string; name: string; portion: string | null; search_text: string | null; source: CacheSource; serving_g: number | null; analysis: unknown; similarity: number | null };
export type VectorCandidate = { name: string; source: CacheSource; similarity: number | null; verdict: string };

/** Words people use for the same serving container. */
const UNIT_ALIASES: Record<string, string> = { katori: "bowl", mug: "cup", pc: "piece", pcs: "piece", no: "piece", nos: "piece", serving: "piece" };
const WEIGHT_WORDS = new Set(["g", "gm", "gms", "gram", "ml", "kg", "oz"]);
const unitKey = (w: string | null | undefined) => (w ? (UNIT_ALIASES[singular(w)] ?? singular(w)) : null);

/** "2 plates", "1 bowl (≈157 g)", "1 tea cup", "1 medium piece (approx 80g)" → { qty, unit: "plate" | "cup" | "piece" } */
function rowServing(row: Row, analysis: Analysis) {
  const text = (row.portion || analysis.items[0]?.portion || "").toLowerCase().split("(")[0];
  const m = text.match(/^\s*(\d+(?:\.\d+)?)\s*(?:x|×)?\s*(?:1\s+)?([a-z ,]*)/);
  const words = (m?.[2] ?? "").split(/[^a-z]+/).filter(Boolean);
  const last = words.pop() ?? null;
  const grams = Number(row.serving_g) || analysis.items.reduce((s, it) => s + it.grams, 0) || null;
  // "100 g" rows are one serving of that weight
  if (!m || !last || WEIGHT_WORDS.has(last)) return { qty: 1, unit: null, grams };
  return { qty: Number(m[1]) || 1, unit: unitKey(last), grams };
}

/** Factor to turn the stored amount into the user's portion, or null if they can't be compared. */
function portionFactor(p: Portion, row: Row, analysis: Analysis): { factor: number; label?: string } | null {
  const s = rowServing(row, analysis);
  if (p.kind === "none") return { factor: 1 };
  if (p.kind === "weight") return s.grams ? { factor: p.grams / s.grams, label: p.label } : null;
  const unit = unitKey(p.unit?.split(" ").pop());
  if (unit === null || unit === s.unit || (unit === "piece" && (s.unit === null || s.unit === "piece"))) {
    return { factor: p.qty / (s.qty || 1), label: `${p.label}${s.unit && !p.unit ? ` ${s.unit}` : ""}` };
  }
  return null;
}

/** Decides which candidate (if any) to reuse. Exported for tests. */
export function evaluate(rows: Row[], ctx: MealContext) {
  const query = tokens(ctx.name ?? "");
  const portion = parsePortion(ctx.portion);
  const candidates: VectorCandidate[] = [];
  const passing: { row: Row; analysis: Analysis; scale: { factor: number; label?: string }; exact: boolean }[] = [];
  const queryKey = [...query].sort().join(" ");

  for (const row of rows) {
    const words = tokens(`${row.name} ${row.search_text ?? ""}`);
    const parsed = analysisSchema.safeParse(row.analysis);
    // A name or alias that is exactly what the user typed ("chole" in "Chickpeas curry (…, chole, …)")
    const phrases = [row.name, ...(row.search_text ?? "").split(/[(),·]/)].map((ph) => tokens(ph).sort().join(" ")).filter(Boolean);
    const exact = phrases.includes(queryKey);
    let verdict = "ok";
    let scale: { factor: number; label?: string } | null = null;
    if (!exact && row.similarity === null) verdict = "text match only (not an exact name)";
    else if (!exact && row.similarity! < MIN_SIMILARITY) verdict = `similarity below ${MIN_SIMILARITY}`;
    else if (!coversQuery(query, words)) verdict = "missing a word you typed";
    else if (keyIngredientClash(query, words)) verdict = "different main ingredient";
    else if (!parsed.success) verdict = "stored analysis is invalid";
    else if (!portion) verdict = "portion is too vague to reuse";
    else if (!(scale = portionFactor(portion, row, parsed.data))) verdict = "portion unit doesn't match the saved one";
    candidates.push({ name: row.name, source: row.source, similarity: row.similarity === null ? null : Math.round(row.similarity * 1000) / 1000, verdict });
    if (verdict === "ok" && parsed.success && scale) passing.push({ row, analysis: parsed.data, scale, exact });
    if (exact && verdict === "ok") candidates[candidates.length - 1].verdict = "ok · exact name";
  }

  // Exact names first, then by similarity
  const sim = (r: Row) => r.similarity ?? 0;
  passing.sort((a, b) => Number(b.exact) - Number(a.exact) || sim(b.row) - sim(a.row));
  const [best, second] = passing;
  if (!best) return { candidates, match: null, reason: "no candidate passed the checks" };
  const sameDish = second && tokens(second.row.name).join(" ") === tokens(best.row.name).join(" ");
  if (second && !sameDish && !best.exact && !second.exact && sim(best.row) - sim(second.row) < AMBIGUITY_MARGIN) {
    return { candidates, match: null, reason: `ambiguous: ${best.row.name} / ${second.row.name}` };
  }
  const scaled = scaleAnalysis(best.analysis, best.scale.factor, best.scale.label);
  return {
    candidates,
    match: { analysis: { ...scaled, meal_name: ctx.name ?? scaled.meal_name }, source: best.row.source, similarity: best.row.similarity, matchedName: best.row.name, exact: best.exact },
  };
}

/** Vector neighbours plus rows whose name/aliases contain the typed text (for exact alias matches). */
async function nearest(name: string, count = 8): Promise<Row[]> {
  const db = createAdmin();
  const phrase = name.normalize("NFKD").replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
  const [[vector], text] = await Promise.all([
    embedTexts([name], "RETRIEVAL_QUERY"),
    phrase.length >= 3
      ? db
          .from("analysis_cache")
          .select("cache_key, name, portion, search_text, source, serving_g, analysis")
          .is("notes", null)
          .or(`name.ilike.%${phrase}%,search_text.ilike.%${phrase}%`)
          .limit(25)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const { data, error } = await db.rpc("match_analysis_cache", { p_embedding: toVector(vector), p_count: count });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const seen = new Set(rows.map((r) => r.cache_key));
  for (const r of (text.data ?? []) as Omit<Row, "similarity">[]) if (!seen.has(r.cache_key)) rows.push({ ...r, similarity: null });
  return rows;
}

/** Best cached match for a meal described in text, or null. Never throws. */
export async function lookupVector(ctx: MealContext) {
  if (ctx.notes || !tokens(ctx.name ?? "").length) return null;
  try {
    return evaluate(await nearest(ctx.name!), ctx).match;
  } catch (err) {
    console.warn("vector lookup failed", (err as Error).message);
    return null;
  }
}

/** Admin diagnostics: the nearest rows and why each was accepted or rejected. */
export async function debugVector(ctx: MealContext) {
  if (ctx.notes) return { candidates: [], match: null, reason: "notes are set, so only an exact saved result is reused" };
  try {
    return evaluate(await nearest(ctx.name ?? "", 10), ctx);
  } catch (err) {
    return { candidates: [], match: null, reason: (err as Error).message };
  }
}
