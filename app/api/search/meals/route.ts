import { after, NextResponse } from "next/server";
import { z } from "zod";
import { embedTexts, toVector } from "@/lib/embeddings";
import { embedMissing, indexMeals, type IndexableMeal } from "@/lib/meal-index";
import { overview, rankHits, type Dish, type DishItem } from "@/lib/meal-search";
import { createAdmin, createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const bodySchema = z.object({
  q: z.string().trim().max(80).default(""),
  /** false: names only, no AI call (used when the person tapped an exact dish or item). */
  similar: z.boolean().default(true),
});

/** Meals linked to their dish (and given a vector) in one request, so the first search after logging many meals stays quick. The rest are done after the answer is sent. */
const INDEX_NOW = 100;
const INDEX_LATER = 400;
const MIN_SEMANTIC_LENGTH = 3;

const embedDocs = (texts: string[]) => embedTexts(texts, "RETRIEVAL_DOCUMENT", { retries: 0, timeoutMs: 15_000 });

type Row = Record<string, unknown>;
const toDish = (r: Row): Dish => ({
  name_key: String(r.name_key),
  name: String(r.name),
  times: Number(r.times),
  first_at: String(r.first_at),
  last_at: String(r.last_at),
  avg_kcal: Number(r.avg_kcal),
  avg_protein: Number(r.avg_protein),
  avg_carbs: Number(r.avg_carbs),
  avg_fat: Number(r.avg_fat),
  breakfast: Number(r.breakfast),
  lunch: Number(r.lunch),
  dinner: Number(r.dinner),
  snack: Number(r.snack),
  cache_keys: Array.isArray(r.cache_keys) ? (r.cache_keys as string[]) : [],
  items: Array.isArray(r.items) ? (r.items as Row[]).map((i): DishItem => ({ key: String(i.key), name: String(i.name), times: Number(i.times) })) : [],
});

/** Links any of this person's meals that aren't yet linked to a dish (a batch now, the rest in the background). Returns true if some were left for later. */
async function linkMeals(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("meals").select("*").is("cache_key", null).order("eaten_at", { ascending: false }).limit(INDEX_NOW + INDEX_LATER);
  const todo = (data ?? []) as IndexableMeal[];
  if (!todo.length) return false;
  const admin = createAdmin();
  const run = (batch: IndexableMeal[]) => indexMeals(admin, embedDocs, toVector, userId, batch);

  await run(todo.slice(0, INDEX_NOW));
  const later = todo.slice(INDEX_NOW);
  if (later.length) {
    try {
      after(() => run(later).catch((e) => console.warn("meal indexing (background) failed", (e as Error).message)));
    } catch {
      // outside a request: skip, the next search picks them up
    }
  }
  return later.length > 0;
}

/**
 * Which of this person's dishes mean something like the query, using the vectors of the analysis_cache rows their meals point at.
 * Meals not yet linked are linked first; rows with no vector yet get one. Returns null if anything fails, and the search carries on by name alone.
 */
async function similarDishes(q: string, supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<{ similar: Map<string, number> | null; learning: boolean }> {
  try {
    const learning = await linkMeals(supabase, userId);
    // Linking changed which keys the dishes have, so read them again
    const { data: fresh, error: freshError } = await supabase.rpc("meal_dishes");
    if (freshError) throw new Error(freshError.message);
    const current = ((fresh as Row[] | null) ?? []).map(toDish);
    const keys = [...new Set(current.flatMap((d) => d.cache_keys ?? []))];
    if (!keys.length) return { similar: new Map(), learning };

    const admin = createAdmin();
    // Rows that were linked but never got a vector (an earlier failure) get one now
    await embedMissing(admin, embedDocs, toVector, keys.slice(0, INDEX_NOW)).catch((e) => console.warn("embedding stragglers failed", (e as Error).message));

    const [queryVector] = await embedTexts([q], "RETRIEVAL_QUERY", { retries: 0, timeoutMs: 6_000 });
    const { data, error } = await admin.rpc("match_cache_keys", { p_embedding: toVector(queryVector), p_keys: keys, p_count: 20 });
    if (error) throw new Error(error.message);
    const bySimilarity = new Map((data as { cache_key: string; similarity: number }[]).map((m) => [m.cache_key, Number(m.similarity)]));

    // A dish is as close as its closest row
    const similar = new Map<string, number>();
    for (const d of current) {
      const best = Math.max(-1, ...(d.cache_keys ?? []).map((k) => bySimilarity.get(k) ?? -1));
      if (best >= 0) similar.set(d.name_key, best);
    }
    return { similar, learning };
  } catch (err) {
    console.warn("dish similarity failed", (err as Error).message);
    return { similar: null, learning: false };
  }
}

/**
 * Search what someone has eaten, by name. Without a query it returns an overview (most eaten, most recent).
 * With one it returns dishes whose names match, then dishes that mean something similar (vector search).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return NextResponse.json({ error: "Please sign in to search your meals." }, { status: 401 });

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "That search is too long." }, { status: 400 });
  const { q, similar: wantSimilar } = body.data;

  const { data, error } = await supabase.rpc("meal_dishes");
  if (error) {
    console.error("meal_dishes failed", error.message);
    return NextResponse.json({ error: "Couldn't load your meals. Please try again." }, { status: 502 });
  }
  const dishes = ((data as Row[] | null) ?? []).map(toDish);

  if (!q) return NextResponse.json({ mode: "overview", ...overview(dishes) });

  // Meaning-based matches need the AI key, a few letters to go on, and some dishes to look through
  let similar: Map<string, number> | null = null;
  let semantic: "on" | "off" | "learning" = "off";
  if (wantSimilar && q.length >= MIN_SEMANTIC_LENGTH && dishes.length && process.env.GEMINI_API_KEY) {
    const result = await similarDishes(q, supabase, auth.claims.sub);
    similar = result.similar;
    semantic = similar ? (result.learning ? "learning" : "on") : "off";
  }

  const hits = rankHits(q, dishes, similar);
  return NextResponse.json({ mode: "search", q, hits, semantic, total: { dishes: dishes.length, meals: dishes.reduce((s, d) => s + d.times, 0) } });
}
