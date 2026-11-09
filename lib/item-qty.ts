import { scaleNutrients } from "./nutrition";
import type { FoodItem } from "./types";

/**
 * Changing how much of one detected item there is ("3 dosas" to "4 dosas").
 * An entry keeps the item as the AI reported it plus the quantity now chosen, and the item is always scaled from that
 * original, so tapping plus and minus never drifts through rounding.
 */
export type ItemEntry = { id: string; base: FoodItem; count: number };

const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };

/** Weights and volumes aren't something you count: "150 g" is handled as a plain multiplier instead. */
const WEIGHT = /^(g|gm|gms|grams?|kg|ml|l|litres?|liters?|oz|lbs?)\b/i;
/** A measure can be halved (half a cup); a count of things (3 dosas) moves in whole numbers. */
const MEASURE = /\b(cups?|bowls?|plates?|servings?|tbsp|tsp|tablespoons?|teaspoons?|glass(?:es)?|spoons?|handfuls?|scoops?|ladles?|katoris?|portions?|mugs?|pinch|dash|packets?|cans?|bottles?)\b/i;
const ABBREVIATION = /^(tbsp|tsp|g|gm|kg|ml|l|oz|lb|lbs)$/i;

/** The leading number of a portion ("3 medium dosas", "1/2 cup", "1.5 cups", "½ bowl") and the words after it. */
export function parseQuantity(portion: string): { n: number; rest: string } | null {
  const m = portion.trim().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+|[½¼¾⅓⅔⅛])(?!\s*[-–]\s*\d)\s*(.*)$/);
  if (!m) return null;
  const raw = m[1];
  let n: number;
  if (raw in FRACTIONS) n = FRACTIONS[raw];
  else if (/^\d+\s+\d+\/\d+$/.test(raw)) {
    const [whole, frac] = raw.split(/\s+/);
    const [a, b] = frac.split("/").map(Number);
    n = Number(whole) + a / b;
  } else if (raw.includes("/")) {
    const [a, b] = raw.split("/").map(Number);
    n = a / b;
  } else n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const rest = m[2];
  if (WEIGHT.test(rest)) return null;
  return { n, rest };
}

const whole = (e: { base: FoodItem }) => {
  const q = parseQuantity(e.base.portion);
  return Boolean(q && Number.isInteger(q.n) && !MEASURE.test(q.rest));
};

export const toEntries = (items: FoodItem[], newId: () => string): ItemEntry[] =>
  items.map((base) => ({ id: newId(), base, count: parseQuantity(base.portion)?.n ?? 1 }));

/** The next quantity up or down: whole numbers for things you count, quarters up to two and then whole numbers for measures. */
export function stepCount(n: number, dir: 1 | -1, wholeOnly: boolean) {
  if (wholeOnly) return Math.max(1, n + dir);
  // Snapped to the quarter grid, so an amount that came in off it (a third of a cup) lands on the next quarter
  if (dir > 0) return n < 2 ? Math.min(2, (Math.floor(n * 4 + 1e-9) + 1) / 4) : n + 1;
  return n > 2 ? n - 1 : Math.max(0.25, (Math.ceil(n * 4 - 1e-9) - 1) / 4);
}

export const stepEntry = (e: ItemEntry, dir: 1 | -1): ItemEntry => ({ ...e, count: stepCount(e.count, dir, whole(e)) });

/** Runs of neighbouring items that belong to the same typed-in dish; an item with no group is a run of its own. */
export function groupRuns(items: { group?: string }[]): { group?: string; indexes: number[] }[] {
  const runs: { group?: string; indexes: number[] }[] = [];
  items.forEach((it, i) => {
    const last = runs[runs.length - 1];
    if (it.group && last?.group === it.group) last.indexes.push(i);
    else runs.push({ group: it.group, indexes: [i] });
  });
  return runs;
}

/** AI insights, bunched: the meal's own (no label), then one bunch per typed-in dish or item. */
export type InsightGroup = { label?: string; insights: string[] };
/** What the AI said about items typed in later, under the dish (or item) it was about. */
export type AddedInsights = { label: string; insights: string[] }[];

/** Saved notes keep the bunch in the line itself: "Paneer gravy › Rich in protein". */
const SEP = " › ";

/** Saved note lines back into bunches. */
export function parseInsights(lines: string[]): InsightGroup[] {
  const groups: InsightGroup[] = [];
  const add = (label: string | undefined, text: string) => {
    const g = groups.find((x) => x.label === label) ?? (groups[groups.push({ label, insights: [] }) - 1]);
    if (!g.insights.includes(text)) g.insights.push(text);
  };
  for (const line of lines) {
    const at = line.indexOf(SEP);
    if (at > 0) add(line.slice(0, at).trim(), line.slice(at + SEP.length).trim());
    else add(undefined, line.trim());
  }
  // The meal's own come first
  return groups.filter((g) => g.insights.some(Boolean)).sort((a, b) => Number(Boolean(a.label)) - Number(Boolean(b.label)));
}

/** The meal's own insights, then a bunch for each added dish or item that is still in the meal, without repeats. */
export function groupInsights(base: string[], added: AddedInsights, entries: { base: { name: string; group?: string } }[]): InsightGroup[] {
  const live = (label: string) => entries.some((e) => e.base.group === label || e.base.name === label);
  const groups = parseInsights(base).filter((g) => !g.label || live(g.label));
  for (const a of added) {
    if (!live(a.label)) continue;
    const g = groups.find((x) => x.label === a.label) ?? (groups[groups.push({ label: a.label, insights: [] }) - 1]);
    for (const t of a.insights) if (!g.insights.includes(t)) g.insights.push(t);
  }
  return groups.filter((g) => g.insights.length);
}

/** One line per insight, ready to save as the meal's notes. */
export const insightLines = (groups: InsightGroup[]): string[] => groups.flatMap((g) => g.insights.map((t) => (g.label ? `${g.label}${SEP}${t}` : t)));

/** The label an added item's insights go under: the dish when it came in parts, else the item's name. */
export const insightLabel = (items: { name: string; group?: string }[]) => items[0]?.group ?? items[0]?.name ?? "Item";

export const fmtQty = (n: number) => String(Math.round(n * 100) / 100);

/** "dosas" for 3 and "dosa" for 1, on the last word only. Abbreviations (tbsp, g) never change. */
function agree(rest: string, count: number) {
  const m = rest.match(/^(.*?)([A-Za-z]+)(\s*)$/);
  if (!m) return rest;
  const [, head, word, tail] = m;
  if (ABBREVIATION.test(word)) return rest;
  let next = word;
  if (count > 1 && !/s$/i.test(word)) next = /(sh|ch|x|z)$/i.test(word) ? `${word}es` : `${word}s`;
  else if (count <= 1 && /s$/i.test(word) && word.length > 3 && !/(ss|us|is)$/i.test(word)) next = word.slice(0, -1);
  return `${head}${next}${tail}`;
}

/** The item as it is now: nutrients, grams and portion wording all follow the chosen quantity. */
export function itemOf(e: ItemEntry): FoodItem {
  const q = parseQuantity(e.base.portion);
  const factor = e.count / (q?.n ?? 1);
  if (factor === 1) return e.base;
  // A weight in brackets, like "(150g)", would now be wrong: grams are shown separately
  const rest = q?.rest.replace(/\s*\(\s*[\d.]+\s*(?:g|gm|kg|ml|oz)\s*\)/i, "").trim();
  const portion = q ? `${fmtQty(e.count)} ${agree(rest ?? "", e.count)}`.trim() : `${e.base.portion} (×${fmtQty(factor)})`.trim();
  return { ...e.base, ...scaleNutrients(e.base, factor), grams: Math.round(e.base.grams * factor), portion };
}

/** True once the quantity has been changed from what was reported. */
export const isEdited = (e: ItemEntry) => itemOf(e) !== e.base;

/** What the stepper shows for an entry, and whether it can go lower. */
export function quantityOf(e: ItemEntry) {
  const q = parseQuantity(e.base.portion);
  return { label: q ? fmtQty(e.count) : `×${fmtQty(e.count)}`, canDown: stepCount(e.count, -1, whole(e)) < e.count };
}
