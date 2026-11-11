import "server-only";
import { after } from "next/server";
import { embedTexts, toVector } from "./embeddings";
import { embedText } from "./meal-embed";
import type { MealContext } from "./gemini";
import { analysisSchema, type Analysis } from "./schemas";
import { createAdmin } from "./supabase/server";
import type { CacheSource } from "./vector-lookup";

export { cacheKey } from "./food-text";

/** Returns a previous text-only analysis (and which provider made it) for the same details, or null. Never throws. */
export async function getCachedAnalysis(
  key: string,
  { touch = true } = {},
): Promise<{ analysis: Analysis; model: string | null; source: CacheSource | null } | null> {
  try {
    const admin = createAdmin();
    const { data } = await admin.from("analysis_cache").select("analysis, model, source").eq("cache_key", key).neq("source", "meal").maybeSingle();
    if (!data) return null;
    const parsed = analysisSchema.safeParse(data.analysis);
    if (!parsed.success) return null;
    if (touch) {
      // Usage bookkeeping: not worth delaying the answer
      const bump = async () => void (await admin.rpc("touch_analysis_cache", { p_key: key }));
      try {
        after(() => bump().catch(() => {}));
      } catch {
        await bump(); // outside a request (scripts, tests)
      }
    }
    return { analysis: parsed.data, model: data.model, source: (data.source as CacheSource) ?? null };
  } catch (err) {
    console.warn("analysis cache read failed", err);
    return null;
  }
}

/** Stores a text-only analysis for reuse, then embeds it after the response so vector search can find it. Never throws. */
export async function saveCachedAnalysis(key: string, ctx: MealContext, analysis: Analysis, model: string, source: CacheSource) {
  const searchText = [...new Set([ctx.name, analysis.meal_name].filter(Boolean))].join(" · ");
  // What the vector is made from: the name, what's in it and the notes (the word checks still use searchText alone)
  const vectorText = embedText(searchText, analysis.items.map((it) => it.name), analysis.insights.join(" "));
  try {
    const admin = createAdmin();
    const { error } = await admin.from("analysis_cache").upsert(
      {
        cache_key: key,
        name: ctx.name,
        portion: ctx.portion ?? null,
        notes: ctx.notes ?? null,
        analysis,
        model,
        source,
        search_text: searchText,
        embed_text: vectorText,
        serving_g: analysis.items.reduce((s, it) => s + it.grams, 0) || null,
      },
      { onConflict: "cache_key", ignoreDuplicates: true },
    );
    if (error) return console.warn("analysis cache write failed", error.message);

    const embed = async () => {
      const [vector] = await embedTexts([vectorText], "RETRIEVAL_DOCUMENT");
      await admin.from("analysis_cache").update({ embedding: toVector(vector), embedded_at: new Date().toISOString() }).eq("cache_key", key);
    };
    try {
      after(() => embed().catch((err) => console.warn("cache embedding failed", (err as Error).message)));
    } catch {
      await embed(); // outside a request (scripts, tests)
    }
  } catch (err) {
    console.warn("analysis cache write failed", err);
  }
}
