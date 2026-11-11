import "server-only";
import { cacheKey, getCachedAnalysis, saveCachedAnalysis } from "./analysis-cache";
import { analyzeMeal, type MealContext } from "./gemini";
import type { Analysis, AnalysisSource } from "./schemas";
import { lookupUsda } from "./usda";
import { lookupVector, type CacheSource } from "./vector-lookup";

export const USDA_MODEL = "usda-fdc";

export type Provider = "ai" | "usda" | "indb" | "ifct";
type Result = { analysis: Analysis; source: AnalysisSource; provider: Provider };

/** Which provider to credit for a cached row. */
export const providerOf = (source: CacheSource | null | undefined, model?: string | null): Provider =>
  source === "usda" || model === USDA_MODEL ? "usda" : source === "indb" ? "indb" : source === "ifct" ? "ifct" : "ai";

/**
 * Text-only meal estimate. analysis_cache is the single source of truth:
 *   1. exact saved result (same name, portion and notes)
 *   2. vector search over analysis_cache (pgvector) with word checks
 *   3. USDA FoodData Central when it has a confident match
 *   4. Gemini (uses AI credits)
 * Results from 3 and 4 are saved back with an embedding, so the cache keeps growing: one row for what was typed, nothing for its parts.
 */
export async function lookupTextMeal(ctx: MealContext): Promise<Result> {
  const key = cacheKey(ctx);

  const exact = await getCachedAnalysis(key);
  if (exact) return { analysis: exact.analysis, source: "cache", provider: providerOf(exact.source, exact.model) };

  const similar = await lookupVector(ctx);
  if (similar) return { analysis: similar.analysis, source: "cache", provider: providerOf(similar.source) };

  const usda = await lookupUsda(ctx);
  if (usda) {
    await saveCachedAnalysis(key, ctx, usda, USDA_MODEL, "usda");
    return { analysis: usda, source: "usda", provider: "usda" };
  }

  const { analysis, model } = await analyzeMeal(null, ctx);
  if (analysis.is_food) {
    await saveCachedAnalysis(key, ctx, analysis, model, "ai");
  }
  return { analysis, source: "text", provider: "ai" };
}
