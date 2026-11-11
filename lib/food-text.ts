import { scaleNutrients } from "./nutrition";
import type { Analysis, Nutrients } from "./schemas";

/** Shared text handling for every food database: tokens, spelling variants, portions and results. */

const STOPWORDS = new Set([
  "a", "an", "the", "and", "with", "of", "in", "on", "some", "my", "plain", "homemade", "fresh",
  "ka", "ki", "ke", "aur", "wala", "wali",
]);

/** Indian dish spellings vary a lot; map every variant to one form (singular, lower case). */
const SPELLING: Record<string, string> = {
  biriyani: "biryani", briyani: "biryani", biriani: "biryani", beryani: "biryani",
  parantha: "paratha", prantha: "paratha", parata: "paratha",
  daal: "dal", dhal: "dal", dahl: "dal",
  khichri: "khichdi", khitchdi: "khichdi", khichadi: "khichdi", kichdi: "khichdi", khichdy: "khichdi",
  rajmah: "rajma",
  chhole: "chole", cholay: "chole", chholey: "chole",
  channa: "chana",
  panir: "paneer",
  alu: "aloo",
  gobhi: "gobi",
  idly: "idli",
  dosai: "dosa",
  sambhar: "sambar",
  poori: "puri",
  sabji: "sabzi", subji: "sabzi", sabjee: "sabzi", subzi: "sabzi",
  chapatti: "chapati", phulka: "chapati",
  uppma: "upma",
  pakoda: "pakora",
  wada: "vada", vadai: "vada",
  khir: "kheer",
  halva: "halwa",
  ladoo: "laddu", laddoo: "laddu", ladu: "laddu",
  jilebi: "jalebi",
  dahi: "curd",
  veg: "vegetable", veggie: "vegetable",
};

/** Simple English singular: berries→berry, tomatoes→tomato, peaches→peach, slices→slice, eggs→egg. */
export function singular(w: string) {
  if (w.length <= 3) return w;
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (/(oes|ches|shes|xes|zes|sses)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Lower-case word tokens with stopwords removed, singular, spelling variants unified. */
export function tokens(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map(singular)
    .map((w) => SPELLING[w] ?? w);
}

// ─── Portions ───────────────────────────────────────────────

const NUMBER_WORDS: Record<string, number> = { half: 0.5, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const WEIGHT_UNITS: Record<string, number> = {
  g: 1, gm: 1, gms: 1, gram: 1, grams: 1, kg: 1000, oz: 28.35, ounce: 28.35, ounces: 28.35, ml: 1, l: 1000, litre: 1000, liter: 1000,
};
const PIECE_WORDS = new Set(["pc", "pcs", "piece", "pieces", "no", "nos", "unit", "units", "serving", "servings"]);
/** Size words change the amount by an unknown factor, so databases don't guess; the AI handles them. */
const SIZE_WORDS = new Set(["small", "medium", "large", "big", "huge", "full", "half", "heaped", "mini", "jumbo"]);

export type Portion =
  | { kind: "none" }
  | { kind: "weight"; grams: number; label: string; liquid: boolean }
  | { kind: "count"; qty: number; unit: string | null; label: string };

/** Parses "2", "2 pcs", "1 bowl", "150 g", "250 ml". Returns null for anything vague ("1 large plate"). */
export function parsePortion(text?: string): Portion | null {
  const t = (text ?? "").trim().toLowerCase();
  if (!t) return { kind: "none" };
  const m = t.match(/^(\d+(?:\.\d+)?|½|¼|half|one|two|three|four|five|six)\s*(.*)$/);
  if (!m) return null;
  const qty = m[1] === "½" ? 0.5 : m[1] === "¼" ? 0.25 : (NUMBER_WORDS[m[1]] ?? Number(m[1]));
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const rest = m[2].replace(/[^a-z ]/g, " ").trim();
  const first = rest.split(/\s+/)[0] ?? "";
  if (first in WEIGHT_UNITS) {
    return { kind: "weight", grams: qty * WEIGHT_UNITS[first], label: `${qty} ${first}`, liquid: ["ml", "l", "litre", "liter"].includes(first) };
  }
  if (qty > 20) return null;
  const words = rest.split(/\s+/).filter(Boolean);
  if (words.some((w) => SIZE_WORDS.has(w))) return null;
  if (!words.length) return { kind: "count", qty, unit: null, label: `${qty}` };
  const unit = words.map(singular).join(" ");
  return { kind: "count", qty, unit: PIECE_WORDS.has(words[0]) ? "piece" : unit, label: `${qty} ${rest}` };
}

// ─── Results ────────────────────────────────────────────────

export function healthScore(n: Nutrients) {
  const kcal = n.calories || 1;
  let s = 6;
  if ((n.protein_g * 4) / kcal >= 0.2) s += 1;
  if (n.fiber_g >= (3 * kcal) / 500) s += 1;
  if ((n.saturated_fat_g * 9) / kcal > 0.1) s -= 1;
  if ((n.sugar_g * 4) / kcal > 0.2) s -= 1;
  if (n.sodium_mg > 800) s -= 1;
  if (kcal > 900) s -= 1;
  return Math.min(10, Math.max(1, s));
}

export function insights(n: Nutrients) {
  const tips: string[] = [];
  const kcal = n.calories || 1;
  if ((n.protein_g * 4) / kcal >= 0.25) tips.push("Good protein density—helps keep you full.");
  else if (n.protein_g < 10) tips.push("Low in protein; pair with eggs, dal, yogurt or lean meat.");
  if (n.sodium_mg > 800) tips.push("High in sodium; balance with low-salt meals today.");
  if ((n.sugar_g * 4) / kcal > 0.2) tips.push("Sugar is high relative to calories.");
  if (n.fiber_g < 3 && tips.length < 3) tips.push("Add vegetables or whole grains for more fiber.");
  return tips.slice(0, 3);
}

/** A database result for one food at a given weight. */
export function buildAnalysis(opts: { mealName: string; foodName: string; per100: Nutrients; grams: number; portionLabel: string; confidence: number }): Analysis {
  const totals = scaleNutrients(opts.per100, opts.grams / 100);
  return {
    is_food: true,
    meal_name: opts.mealName,
    items: [{ ...totals, name: opts.foodName, portion: opts.portionLabel, grams: Math.round(opts.grams) }],
    totals,
    health_score: healthScore(totals),
    confidence: opts.confidence,
    insights: insights(totals),
  };
}

/** Median of numbers (for consensus checks). */
export function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ─── Cache keys ─────────────────────────────────────────────

/** Loose text normalisation for cache keys: "Chicken  Biryani!" → "chicken biryani" (any script). */
const normKey = (v?: string) =>
  (v ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();

/** Exact-match key for a meal: normalised name|portion|notes. */
export function cacheKey(ctx: { name?: string; portion?: string; notes?: string }) {
  return [normKey(ctx.name), normKey(ctx.portion), normKey(ctx.notes)].join("|");
}

// ─── Fuzzy matching (for vector search candidates) ──────────

function editDistance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** "makhni" ≈ "makhani", "chikn" ≈ "chicken": 1 typo for 4+ letters; 2 for 8+, or 5+ when the first letter matches. */
export function fuzzyEqual(a: string, b: string) {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  const allowed = shorter >= 8 || (shorter >= 5 && a[0] === b[0]) ? 2 : shorter >= 4 ? 1 : 0;
  return allowed > 0 && editDistance(a, b) <= allowed;
}

/** Main ingredients that make two dishes different even when the rest of the name matches. */
const KEY_INGREDIENTS = [
  ["chicken"], ["mutton", "lamb", "goat", "gosht"], ["fish", "machli", "machhi"], ["prawn", "shrimp", "jhinga"], ["egg", "anda"],
  ["beef"], ["pork"], ["paneer"], ["vegetable"], ["mushroom"], ["soya", "soy"], ["tofu"], ["keema", "mince"],
];
const keyGroup = (t: string) => KEY_INGREDIENTS.findIndex((g) => g.includes(t));

/** True if the query and candidate name different main ingredients (chicken vs mutton biryani). */
export function keyIngredientClash(query: string[], candidate: string[]) {
  const q = new Set(query.map(keyGroup).filter((g) => g >= 0));
  const c = new Set(candidate.map(keyGroup).filter((g) => g >= 0));
  if (!q.size) return false;
  return [...q].some((g) => !c.has(g)) || [...c].some((g) => !q.has(g));
}

/** Every query word appears (allowing small typos) in the candidate's words. */
export const coversQuery = (query: string[], candidate: string[]) => query.every((q) => candidate.some((c) => fuzzyEqual(q, c)));

/** Scales an analysis to a new amount (e.g. 2 bowls instead of 1). */
export function scaleAnalysis(a: Analysis, factor: number, portionLabel?: string): Analysis {
  if (factor === 1 && !portionLabel) return a;
  const items = a.items.map((it, i) => ({
    ...it,
    ...scaleNutrients(it, factor),
    grams: Math.round(it.grams * factor),
    portion: i === 0 && portionLabel ? portionLabel : it.portion,
  }));
  return { ...a, items, totals: scaleNutrients(a.totals, factor) };
}

// ─── One typed item ─────────────────────────────────────────

const QTY = String.raw`\d+(?:\.\d+)?|\d+\/\d+|[½¼¾]|half|one|two|three|four|five|six|an?`;
const UNITS = String.raw`g|gm|gms|grams?|kg|ml|l|oz|cups?|bowls?|katoris?|glass(?:es)?|plates?|pieces?|pcs?|slices?|tbsp|tsp|spoons?|scoops?|handfuls?`;
const LEADING = new RegExp(String.raw`^(${QTY})\s*(?:x\s*)?(${UNITS})\b\s*(?:of\s+)?(.+)$|^(${QTY})\s+(?:x\s*)?(.+)$`, "i");
const TRAILING = new RegExp(String.raw`^(.+?)[\s,\-–(]+(\d+(?:\.\d+)?)\s*(g|gm|gms|grams?|kg|ml|oz)\)?$`, "i");

/** "½", "1/2", "half" and "two" as a plain number, which is what the portion parser understands. */
function plainQuantity(q: string) {
  const w = q.toLowerCase();
  const word: Record<string, string> = { a: "1", an: "1", one: "1", half: "0.5", two: "2", three: "3", four: "4", five: "5", six: "6", "½": "0.5", "¼": "0.25", "¾": "0.75" };
  if (w in word) return word[w];
  const frac = w.match(/^(\d+)\/(\d+)$/);
  if (frac && Number(frac[2])) return String(Math.round((Number(frac[1]) / Number(frac[2])) * 100) / 100);
  return w;
}

/**
 * Splits what someone typed for one item into the dish and how much of it, so the same lookup as the
 * meal name box can be used: "2 rotis" → rotis / 2, "1 cup rice" → rice / 1 cup, "paneer 100g" → paneer / 100 g, "dal" → dal.
 */
export function splitItemText(text: string): { name: string; portion?: string } {
  const t = text.trim().replace(/\s+/g, " ");
  const lead = t.match(LEADING);
  if (lead) {
    const n = plainQuantity(lead[1] ?? lead[4]);
    const unit = lead[2];
    const name = (lead[3] ?? lead[5]).trim();
    if (name) return { name, portion: unit ? `${n} ${unit}` : n };
  }
  const trail = t.match(TRAILING);
  if (trail && trail[1].trim()) return { name: trail[1].trim(), portion: `${trail[2]} ${trail[3]}` };
  return { name: t };
}
