import { tokens } from "./food-text";

/** Something found inside a dish's meals (the chutney in a dosa meal), and how many of the dish's meals had it. */
export type DishItem = { key: string; name: string; times: number };

/** One dish the person has logged: all their meals with the same name, with counts and averages. */
export type Dish = {
  name_key: string;
  name: string;
  times: number;
  first_at: string;
  last_at: string;
  avg_kcal: number;
  avg_protein: number;
  avg_carbs: number;
  avg_fat: number;
  breakfast: number;
  lunch: number;
  dinner: number;
  snack: number;
  /** What was found inside these meals, most common first. */
  items: DishItem[];
  /** The analysis_cache rows these meals point at (their vectors are what meaning-based search uses). */
  cache_keys?: string[];
};

/**
 * `via` says how it matched: the words typed, or because it means something similar.
 * `inItem` is set when what matched was something inside the dish rather than the dish's own name.
 */
export type Hit = Dish & { score: number; via: "name" | "similar"; inItem?: string };

/**
 * Meaning-based matches are only trusted when they're clearly close: at least this similar, and within a small margin of the
 * best one, so one strong match doesn't drag in a tail of weak ones. Tune these on real data (similarity is cosine, 0 to 1).
 */
export const SEMANTIC_FLOOR = 0.6;
export const SEMANTIC_BAND = 0.08;
export const MAX_SIMILAR = 8;
export const MAX_HITS = 40;
/** A match on something inside a dish counts a little less than a match on the dish itself, so the dish comes first. */
const ITEM_WEIGHT = 0.88;

/**
 * A scorer for one query: how well a name matches what was typed, from 0 (not at all) to 1 (the same).
 * Uses the same word handling as food lookups, so "dahi" meets "curd" and "chapatti" meets "chapati".
 * Every word but the last must match whole; the last may be a start (someone still typing "chick").
 * Reads the query once, so scoring a thousand dishes and their items stays cheap.
 */
export function scorerFor(query: string): (name: string) => number {
  const q = tokens(query);
  const typed = q.join(" ");
  const raw = query.trim().toLowerCase();
  const last = q.length - 1;
  return (name) => {
    if (!q.length) return 0;
    const n = tokens(name);
    if (!n.length) return 0;
    const have = n.join(" ");
    if (typed === have) return 1;

    const covered = q.filter((t, i) => n.some((w) => (i === last ? w.startsWith(t) : w === t))).length;
    if (covered === q.length) {
      // Whole words beat a word that's only been started: typing "dal" finds "Dal rice" before "Dalia upma"
      const whole = q.every((t) => n.includes(t));
      if (whole) return have.startsWith(typed) ? 0.95 : 0.9;
      return have.startsWith(typed) ? 0.86 : 0.82;
    }
    // What was typed appears inside the name as written
    if (name.toLowerCase().includes(raw)) return 0.85;
    return covered ? (0.55 * covered) / q.length : 0;
  };
}

export const lexicalScore = (query: string, name: string) => scorerFor(query)(name);

/** Mixes name matches with meaning matches into one ranked list. `similar` maps a dish or item key to its similarity, or is null when unavailable. */
export function rankHits(query: string, dishes: Dish[], similar: Map<string, number> | null): Hit[] {
  let accepted = new Map<string, number>();
  if (similar && similar.size) {
    const best = Math.max(...similar.values());
    const bar = Math.max(SEMANTIC_FLOOR, best - SEMANTIC_BAND);
    accepted = new Map([...similar].filter(([, s]) => s >= bar).sort((a, b) => b[1] - a[1]).slice(0, MAX_SIMILAR));
  }
  // A meaning match scores below a good name match, but above a stray shared word
  const bySense = (key: string) => {
    const sim = accepted.get(key);
    return sim === undefined ? 0 : Math.min(0.8, 0.5 + (sim - SEMANTIC_FLOOR) * 1.5);
  };
  const score = scorerFor(query);

  const hits: Hit[] = [];
  for (const d of dishes) {
    const byName = score(d.name);
    const bySenseDish = bySense(d.name_key);
    let best: Hit = { ...d, score: Math.max(byName, bySenseDish), via: byName >= bySenseDish ? "name" : "similar" };

    // The same for what's inside the dish; it wins only if it beats the dish itself
    for (const item of d.items) {
      if (item.key === d.name_key) continue; // a one-item meal: the item is the dish
      const lex = score(item.name) * ITEM_WEIGHT;
      const sense = bySense(item.key) * ITEM_WEIGHT;
      const s = Math.max(lex, sense);
      if (s > best.score) best = { ...d, score: s, via: lex >= sense ? "name" : "similar", inItem: item.name };
    }
    if (best.score > 0) hits.push(best);
  }
  return hits.sort((a, b) => b.score - a.score || b.times - a.times || b.last_at.localeCompare(a.last_at)).slice(0, MAX_HITS);
}

/** What to show before anything is typed: the dishes eaten most, and the ones eaten last. */
export function overview(dishes: Dish[]) {
  const top = [...dishes].sort((a, b) => b.times - a.times || b.last_at.localeCompare(a.last_at)).slice(0, 10);
  const recent = [...dishes].sort((a, b) => b.last_at.localeCompare(a.last_at)).slice(0, 12);
  return { top, recent, total: { dishes: dishes.length, meals: dishes.reduce((s, d) => s + d.times, 0) } };
}

/** The meal type a dish is most often eaten as ("Log again" opens on it). */
export function usualMealType(d: Pick<Dish, "breakfast" | "lunch" | "dinner" | "snack">) {
  const entries = [["breakfast", d.breakfast], ["lunch", d.lunch], ["dinner", d.dinner], ["snack", d.snack]] as const;
  return entries.reduce((best, e) => (e[1] > best[1] ? e : best))[0];
}
