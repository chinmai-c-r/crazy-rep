import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheKey } from "./food-text";
import { embedText, mealToAnalysis } from "./meal-embed";

type Embed = (texts: string[]) => Promise<number[][]>;
type ToVector = (v: number[]) => string;

export const MEAL_KEY = "meal:";

export type IndexableMeal = Parameters<typeof mealToAnalysis>[0] & { id: string };

const itemNamesOf = (items: unknown): string[] =>
  Array.isArray(items) ? items.map((i) => (i && typeof i === "object" ? String((i as { name?: unknown }).name ?? "") : "")).filter(Boolean) : [];

/** Gives rows that have no vector yet (or whose text changed) one. Returns how many it embedded. Takes the database and embedder as arguments so it can be tested without either. */
export async function embedMissing(admin: SupabaseClient, embed: Embed, toVector: ToVector, keys: string[]): Promise<number> {
  if (!keys.length) return 0;
  const { data, error } = await admin.from("analysis_cache").select("cache_key, name, search_text, embed_text").in("cache_key", keys).is("embedded_at", null);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { cache_key: string; name: string; search_text: string | null; embed_text: string | null }[];
  if (!rows.length) return 0;

  const vectors = await embed(rows.map((r) => r.embed_text ?? r.search_text ?? r.name));
  const { error: setError } = await admin.rpc("set_cache_embeddings", { p_rows: rows.map((r, i) => ({ cache_key: r.cache_key, embedding: toVector(vectors[i]) })) });
  if (setError) throw new Error(setError.message);
  return rows.length;
}

/**
 * Links meals to the analysis_cache row for their dish, so that one vector (name, items and notes) serves both the log-a-meal
 * lookup and searching what you've eaten. A meal that is just the dish as looked up uses the dish's own row; one with extra items,
 * or a dish that isn't in the cache yet, gets a row of its own, shaped from the meal itself.
 * A row that has no item or note text yet gets it from the first meal that points at it, and is embedded again.
 * Returns how many meals were linked. Linking happens first, so a failed embedding only delays search (the next call retries).
 */
export async function indexMeals(admin: SupabaseClient, embed: Embed, toVector: ToVector, userId: string, meals: IndexableMeal[]): Promise<number> {
  const named = meals.flatMap((m) => {
    const plain = cacheKey({ name: m.name });
    return plain.startsWith("|") ? [] : [{ m, plain }]; // no usable name: skip
  });
  if (!named.length) return 0;

  // A meal that is just the dish as it was looked up (same name, nothing added) points at that dish's own row, so logging it
  // adds no row at all. Only a meal with extra items gets a row of its own, in its own key space ("meal:") so it is never
  // mistaken for a food's saved nutrition (keys of foods have no colon).
  const plainKeys = [...new Set(named.map((n) => n.plain))];
  const { data: dishes, error: dishError } = await admin.from("analysis_cache").select("cache_key, source, analysis").in("cache_key", plainKeys);
  if (dishError) throw new Error(dishError.message);
  const dishItems = new Map(
    ((dishes ?? []) as { cache_key: string; source: string; analysis: unknown }[])
      .filter((r) => r.source !== "meal")
      .map((r) => [r.cache_key, new Set(itemNamesOf((r.analysis as { items?: unknown } | null)?.items).map((n) => n.trim().toLowerCase()))]),
  );

  const byKey = new Map<string, IndexableMeal[]>();
  for (const { m, plain } of named) {
    const parts = dishItems.get(plain);
    const plainDish = parts !== undefined && itemNamesOf(m.items).every((n) => parts.has(n.trim().toLowerCase()));
    const key = plainDish ? plain : `${MEAL_KEY}${plain}`;
    byKey.set(key, [...(byKey.get(key) ?? []), m]);
  }
  const keys = [...byKey.keys()];

  const { data: existing, error } = await admin.from("analysis_cache").select("cache_key, embed_text").in("cache_key", keys);
  if (error) throw new Error(error.message);
  const have = new Map(((existing ?? []) as { cache_key: string; embed_text: string | null }[]).map((r) => [r.cache_key, r.embed_text]));

  const created = [];
  for (const [key, group] of byKey) {
    const m = group[0];
    const text = embedText(m.name, itemNamesOf(m.items), m.notes);
    if (!have.has(key)) {
      const analysis = mealToAnalysis(m);
      created.push({
        cache_key: key,
        name: m.name,
        portion: null,
        notes: null,
        analysis,
        model: "meal",
        source: "meal",
        search_text: m.name,
        embed_text: text,
        serving_g: analysis.items.reduce((s, it) => s + it.grams, 0) || null,
      });
    } else if (!have.get(key)) {
      // A row from before items and notes were part of its vector: add them, and mark it for embedding again
      const { error: upError } = await admin.from("analysis_cache").update({ embed_text: text, embedded_at: null }).eq("cache_key", key).is("embed_text", null);
      if (upError) throw new Error(upError.message);
    }
  }
  if (created.length) {
    const { error: insError } = await admin.from("analysis_cache").upsert(created, { onConflict: "cache_key", ignoreDuplicates: true });
    if (insError) throw new Error(insError.message);
  }

  let linked = 0;
  for (const [key, group] of byKey) {
    const { error: linkError } = await admin.from("meals").update({ cache_key: key }).in("id", group.map((m) => m.id)).eq("user_id", userId);
    if (linkError) throw new Error(linkError.message);
    linked += group.length;
  }

  await embedMissing(admin, embed, toVector, keys);
  return linked;
}
