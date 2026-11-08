import { healthScore } from "./food-text";
import { analysisSchema, foodItemSchema, type Analysis } from "./schemas";
import { z } from "zod";

const MAX_ITEMS = 8;
const MAX_NOTES = 200;

/**
 * The text that gets turned into a dish's vector: its name, what's in it and the notes. Words from the items and notes mean a
 * search for "curd" or "high protein" can find a dish whose name doesn't say so. Kept short, so the name still carries the meaning.
 */
export function embedText(name: string, itemNames: string[] = [], notes?: string | null) {
  const items = [...new Set(itemNames.map((n) => n.trim()).filter(Boolean))].filter((n) => n.toLowerCase() !== name.trim().toLowerCase()).slice(0, MAX_ITEMS);
  const note = (notes ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NOTES);
  return [name.trim(), items.length ? `Contains: ${items.join(", ")}.` : "", note ? `Notes: ${note}` : ""].filter(Boolean).join(" ");
}

type MealLike = {
  name: string;
  servings: number | string;
  calories: number | string;
  protein_g: number | string;
  carbs_g: number | string;
  fat_g: number | string;
  fiber_g: number | string;
  sugar_g: number | string;
  saturated_fat_g: number | string;
  sodium_mg: number | string;
  cholesterol_mg: number | string;
  items?: unknown;
  notes?: string | null;
  health_score?: number | null;
  confidence?: number | null;
};

/** What a logged meal looked like for one serving, shaped like an AI answer so it can sit in analysis_cache. */
export function mealToAnalysis(meal: MealLike): Analysis {
  const servings = Number(meal.servings) || 1;
  const per = (v: number | string) => Math.round(((Number(v) || 0) / servings) * 10) / 10;
  const totals = {
    calories: per(meal.calories),
    protein_g: per(meal.protein_g),
    carbs_g: per(meal.carbs_g),
    fat_g: per(meal.fat_g),
    fiber_g: per(meal.fiber_g),
    sugar_g: per(meal.sugar_g),
    saturated_fat_g: per(meal.saturated_fat_g),
    sodium_mg: per(meal.sodium_mg),
    cholesterol_mg: per(meal.cholesterol_mg),
  };
  const items = z.array(foodItemSchema).safeParse(meal.items);
  return analysisSchema.parse({
    is_food: true,
    meal_name: meal.name,
    items: items.success ? items.data : [],
    totals,
    health_score: meal.health_score ?? healthScore(totals),
    confidence: meal.confidence ?? 0.5,
    insights: (meal.notes ?? "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3),
  });
}
