import { after, NextResponse } from "next/server";
import { z } from "zod";
import { embedTexts, toVector } from "@/lib/embeddings";
import { overview, rankHits, type Dish, type DishItem } from "@/lib/meal-search";
import { createAdmin, createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const bodySchema = z.object({ q: z.string().trim().max(80).default("") });

/** Dishes embedded in one request, so the first search after logging many new meals stays quick. The rest are done after the answer is sent. */
const EMBED_NOW = 100;
const EMBED_LATER = 400;
const MIN_SEMANTIC_LENGTH = 3;

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
  items: Array.isArray(r.items) ? (r.items as Row[]).map((i): DishItem => ({ key: String(i.key), name: String(i.name), times: Number(i.times) })) : [],
});

/** Dishes whose items are also matched by meaning, and how many items each (the most recent dishes and their commonest items keep this small). */
const ITEM_DISHES = 300;
const ITEMS_PER_DISH = 5;

async function storeEmbeddings(keys: string[]) {
  if (!keys.length) return;
  const vectors = await embedTexts(keys, "RETRIEVAL_DOCUMENT", { retries: 0, timeoutMs: 15_000 });
  await createAdmin().rpc("set_dish_embeddings", { p_rows: keys.map((name_key, i) => ({ name_key, embedding: toVector(vectors[i]) })) });
}

/**
 * Which of this person's dishes mean something like the query. Works by name vectors:
 * dishes without a vector get one (a batch now, the rest in the background), then the nearest to the query are picked.
 * Matches only against this person's own dish names. Returns null if anything fails, and the search carries on by name alone.
 */
async function similarDishes(q: string, keys: string[]): Promise<{ similar: Map<string, number> | null; learning: boolean }> {
  try {
    const admin = createAdmin();
    const { data: missing } = await admin.rpc("missing_dish_embeddings", { p_keys: keys });
    const todo = ((missing as { name_key: string }[] | null) ?? []).map((m) => m.name_key);
    const now = todo.slice(0, EMBED_NOW);

    // The query and any new names are embedded together, then stored before matching
    const [[queryVector]] = await Promise.all([embedTexts([q], "RETRIEVAL_QUERY", { retries: 0, timeoutMs: 6_000 }), storeEmbeddings(now)]);

    const later = todo.slice(EMBED_NOW, EMBED_NOW + EMBED_LATER);
    if (later.length) {
      try {
        after(() => storeEmbeddings(later).catch((e) => console.warn("dish embeddings (background) failed", (e as Error).message)));
      } catch {
        // outside a request: skip, the next search picks them up
      }
    }

    const { data, error } = await admin.rpc("match_dish_names", { p_embedding: toVector(queryVector), p_keys: keys, p_count: 20 });
    if (error) throw new Error(error.message);
    const similar = new Map((data as { name_key: string; similarity: number }[]).map((m) => [m.name_key, Number(m.similarity)]));
    return { similar, learning: todo.length > EMBED_NOW };
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
  const { q } = body.data;

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
  if (q.length >= MIN_SEMANTIC_LENGTH && dishes.length && process.env.GEMINI_API_KEY) {
    // Dish names, plus the commonest items of the dishes eaten most recently
    const keys = new Set(dishes.map((d) => d.name_key));
    for (const d of dishes.slice(0, ITEM_DISHES)) for (const item of d.items.slice(0, ITEMS_PER_DISH)) keys.add(item.key);
    const result = await similarDishes(q, [...keys]);
    similar = result.similar;
    semantic = similar ? (result.learning ? "learning" : "on") : "off";
  }

  const hits = rankHits(q, dishes, similar);
  return NextResponse.json({ mode: "search", q, hits, semantic, total: { dishes: dishes.length, meals: dishes.reduce((s, d) => s + d.times, 0) } });
}
