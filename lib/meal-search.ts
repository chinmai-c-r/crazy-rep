import { tokens } from "./food-text";

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
};

/** `via` says why it matched: the name itself, or because it means something similar to what was typed. */
export type Hit = Dish & { score: number; via: "name" | "similar" };

/**
 * Meaning-based matches are only trusted when they're clearly close: at least this similar, and within a small margin of the
 * best one, so one strong match doesn't drag in a tail of weak ones. Tune these on real data (similarity is cosine, 0 to 1).
 */
export const SEMANTIC_FLOOR = 0.6;
export const SEMANTIC_BAND = 0.08;
export const MAX_SIMILAR = 8;
export const MAX_HITS = 40;

/**
 * How well a dish name matches what was typed, from 0 (not at all) to 1 (the same).
 * Uses the same word handling as food lookups, so "dahi" meets "curd" and "chapatti" meets "chapati".
 * Every word but the last must match whole; the last may be a start (someone still typing "chick").
 */
export function lexicalScore(query: string, name: string): number {
  const q = tokens(query);
  if (!q.length) return 0;
  const n = tokens(name);
  if (!n.length) return 0;
  const typed = q.join(" ");
  const have = n.join(" ");
  if (typed === have) return 1;

  const last = q.length - 1;
  const covered = q.filter((t, i) => n.some((w) => (i === last ? w.startsWith(t) : w === t))).length;
  if (covered === q.length) {
    // Whole words beat a word that's only been started: typing "dal" finds "Dal rice" before "Dalia upma"
    const whole = q.every((t) => n.includes(t));
    if (whole) return have.startsWith(typed) ? 0.95 : 0.9;
    return have.startsWith(typed) ? 0.86 : 0.82;
  }
  // What was typed appears inside the name as written ("masala" in "paneer butter masala" is covered above; this catches the rest)
  if (name.toLowerCase().includes(query.trim().toLowerCase())) return 0.85;
  return covered ? (0.55 * covered) / q.length : 0;
}

/** Mixes name matches with meaning matches into one ranked list. `similar` maps a dish key to its similarity, or is null when unavailable. */
export function rankHits(query: string, dishes: Dish[], similar: Map<string, number> | null): Hit[] {
  let accepted = new Map<string, number>();
  if (similar && similar.size) {
    const best = Math.max(...similar.values());
    const bar = Math.max(SEMANTIC_FLOOR, best - SEMANTIC_BAND);
    accepted = new Map([...similar].filter(([, s]) => s >= bar).sort((a, b) => b[1] - a[1]).slice(0, MAX_SIMILAR));
  }

  const hits: Hit[] = [];
  for (const d of dishes) {
    const byName = lexicalScore(query, d.name);
    const sim = accepted.get(d.name_key);
    // A meaning match scores below a good name match, but above a stray shared word
    const bySense = sim === undefined ? 0 : Math.min(0.8, 0.5 + (sim - SEMANTIC_FLOOR) * 1.5);
    const score = Math.max(byName, bySense);
    if (score <= 0) continue;
    hits.push({ ...d, score, via: byName >= bySense ? "name" : "similar" });
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
