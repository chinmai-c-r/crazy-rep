import type { Diet, Profile } from "./types";

export const DEFAULT_DIET: Diet = "vegetarian";

/** The diet to use for a profile. A profile that has none (not loaded yet, or read before the migration) is vegetarian. */
export const dietOf = (profile: Pick<Profile, "diet"> | null | undefined): Diet => profile?.diet ?? DEFAULT_DIET;

export const DIET_OPTIONS: { id: Diet; label: string; emoji: string; hint: string; noun: string }[] = [
  { id: "vegetarian", label: "Vegetarian", emoji: "🥦", hint: "No meat, fish or eggs. Dairy is fine.", noun: "vegetarian" },
  { id: "non_vegetarian", label: "Non-veg", emoji: "🍗", hint: "Everything is on the menu.", noun: "non-vegetarian" },
  { id: "vegan", label: "Vegan", emoji: "🌱", hint: "No animal products at all.", noun: "vegan" },
];

/** How the coach is told about the diet. Vegetarian follows the Indian convention: no eggs. */
export const DIET_PROMPT: Record<Diet, string> = {
  vegetarian:
    "The user is vegetarian: no meat, poultry, fish, seafood or eggs (dairy and honey are fine). Every food, recipe or meal idea you suggest must fit that. Never suggest non-vegetarian food, and for protein point to paneer, dairy, lentils, beans, tofu, soy and nuts. If they logged something that isn't vegetarian, don't lecture them.",
  vegan:
    "The user is vegan: no meat, fish, eggs, dairy, honey or any other animal product. Every food, recipe or meal idea you suggest must be fully plant-based. For protein point to lentils, beans, tofu, tempeh, soy, seitan and nuts. If they logged something that isn't vegan, don't lecture them.",
  non_vegetarian: "The user eats everything, so any food is fine to suggest.",
};

/* ─── Starter dish ideas ───────────────────────────────────────── */

/** `diet` is the strictest diet a dish suits: a vegan dish suits everyone, a vegetarian one suits vegetarians and meat eaters. */
const IDEAS: { name: string; diet: Diet }[] = [
  { name: "Masala dosa", diet: "vegetarian" },
  { name: "Paneer butter masala", diet: "vegetarian" },
  { name: "Greek yogurt bowl", diet: "vegetarian" },
  { name: "Palak paneer", diet: "vegetarian" },
  { name: "Chole bhature", diet: "vegetarian" },
  { name: "Oats with banana", diet: "vegan" },
  { name: "Dal and rice", diet: "vegan" },
  { name: "Avocado toast", diet: "vegan" },
  { name: "Idli sambar", diet: "vegan" },
  { name: "Poha", diet: "vegan" },
  { name: "Rajma chawal", diet: "vegan" },
  { name: "Tofu stir fry", diet: "vegan" },
  { name: "Veg fried rice", diet: "vegan" },
  { name: "Upma", diet: "vegan" },
  { name: "Chicken biryani", diet: "non_vegetarian" },
  { name: "Egg omelette", diet: "non_vegetarian" },
  { name: "Butter chicken", diet: "non_vegetarian" },
  { name: "Grilled chicken salad", diet: "non_vegetarian" },
  { name: "Fish curry", diet: "non_vegetarian" },
];

const RANK: Record<Diet, number> = { vegan: 0, vegetarian: 1, non_vegetarian: 2 };

/** Dish names for the meal name box that fit a diet, with the dishes most people recognise first. */
export function ideasFor(diet: Diet): string[] {
  return IDEAS.filter((i) => RANK[i.diet] <= RANK[diet]).map((i) => i.name);
}

/* ─── Spotting food that doesn't fit ───────────────────────────── */

type Kind = "meat" | "fish" | "egg" | "dairy";

/** Unambiguous words only: "kebab", "biryani" and "curry" can be vegetarian, so they are left out. */
const WORDS: { kind: Kind; re: RegExp }[] = [
  { kind: "meat", re: /\b(chicken|mutton|lamb|goat|beef|pork|bacon|ham|sausages?|salami|pepperoni|turkey|duck|steak|meatballs?|meat|prosciutto)\b/i },
  { kind: "fish", re: /\b(fish|prawns?|shrimps?|salmon|tuna|crab|lobster|squid|sardines?|mackerel|anchov(?:y|ies)|pomfret|hilsa|rohu|seafood)\b/i },
  { kind: "egg", re: /\b(eggs?|omelette|omelet)\b/i },
  {
    kind: "dairy",
    re: /(?<!coconut |almond |soy |soya |oat |rice |cashew |plant )\bmilk\b|\b(paneer|cheese|curd|dahi|yogh?urt|ghee|lassi|raita|whey|honey)\b|(?<!peanut |almond |cashew |nut |cocoa |shea )\bbutter\b/i,
  },
];

const FORBIDDEN: Record<Diet, Kind[]> = {
  non_vegetarian: [],
  vegetarian: ["meat", "fish", "egg"],
  vegan: ["meat", "fish", "egg", "dairy"],
};

/** The first word in `text` that a diet rules out, or null. Meant for a gentle heads-up, not a verdict. */
export function dietConflict(diet: Diet, text: string): string | null {
  for (const { kind, re } of WORDS) {
    if (!FORBIDDEN[diet].includes(kind)) continue;
    const m = text.match(re);
    if (m) return m[0].toLowerCase();
  }
  return null;
}
