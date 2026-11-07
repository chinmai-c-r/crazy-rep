import type { SupabaseClient } from "@supabase/supabase-js";
import { itemRows } from "./food-text";
import type { Analysis } from "./schemas";

/**
 * Saves each item of an AI answer as its own analysis_cache row (with a vector), unless that item is already there.
 * Later, when someone adds that food by name, the lookup finds it in the database instead of asking the AI again.
 * Takes the database client and the embedder as arguments so it can be tested without either. Returns how many rows were new.
 */
export async function seedItems(
  admin: SupabaseClient,
  embed: (texts: string[]) => Promise<number[][]>,
  toVector: (v: number[]) => string,
  analysis: Analysis,
  model: string,
): Promise<number> {
  const rows = itemRows(analysis);
  if (!rows.length) return 0;

  // ignoreDuplicates leaves rows that exist untouched, and only the rows it actually added come back
  const { data, error } = await admin
    .from("analysis_cache")
    .upsert(
      rows.map((r) => ({
        cache_key: r.key,
        name: r.name,
        portion: r.portion || null,
        notes: null,
        analysis: r.analysis,
        model,
        source: "ai",
        search_text: r.name,
        serving_g: r.grams || null,
      })),
      { onConflict: "cache_key", ignoreDuplicates: true },
    )
    .select("cache_key, search_text");
  if (error) throw new Error(error.message);

  const added = (data ?? []) as { cache_key: string; search_text: string }[];
  if (!added.length) return 0;

  // One embedding request for all the new rows, then one call to store the vectors
  const vectors = await embed(added.map((r) => r.search_text));
  const { error: setError } = await admin.rpc("set_cache_embeddings", { p_rows: added.map((r, i) => ({ cache_key: r.cache_key, embedding: toVector(vectors[i]) })) });
  if (setError) throw new Error(setError.message);
  return added.length;
}
