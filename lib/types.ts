import type { z } from "zod";
import type { activitySchema, AnalysisSource, dietSchema, FoodItem, goalSchema, mealTypeSchema, Nutrients, sexSchema } from "./schemas";

export type { Analysis, FoodItem, Nutrients } from "./schemas";

export type MealType = z.infer<typeof mealTypeSchema>;

export const MEAL_TYPES: { value: MealType; label: string; icon: string }[] = [
  { value: "breakfast", label: "Breakfast", icon: "🍳" },
  { value: "lunch", label: "Lunch", icon: "🥗" },
  { value: "dinner", label: "Dinner", icon: "🍝" },
  { value: "snack", label: "Snack", icon: "🍎" },
];

export const NUTRIENT_KEYS: (keyof Nutrients)[] = [
  "calories",
  "protein_g",
  "carbs_g",
  "fat_g",
  "fiber_g",
  "sugar_g",
  "saturated_fat_g",
  "sodium_mg",
  "cholesterol_mg",
];

export type Meal = Nutrients & {
  id: string;
  user_id: string;
  eaten_at: string;
  meal_type: MealType;
  name: string;
  image_path: string | null;
  source: AnalysisSource;
  servings: number;
  health_score: number | null;
  confidence: number | null;
  items: FoodItem[];
  notes: string | null;
  created_at: string;
};

export type Sex = z.infer<typeof sexSchema>;
export type ActivityLevel = z.infer<typeof activitySchema>;
export type Diet = z.infer<typeof dietSchema>;
export type Goal = z.infer<typeof goalSchema>;

export type Profile = {
  id: string;
  display_name: string | null;
  sex: Sex | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel;
  goal: Goal;
  /** Missing on a profile read before the diet migration ran; treat as vegetarian (see dietOf). */
  diet?: Diet;
  calorie_goal: number;
  protein_goal_g: number;
  carbs_goal_g: number;
  fat_goal_g: number;
  water_goal_ml: number;
};

export type ActivityLog = {
  id: string;
  performed_at: string;
  activity: string;
  intensity: "light" | "moderate" | "vigorous";
  duration_min: number;
  calories_burned: number;
  distance_km: number | null;
  steps: number | null;
  notes: string | null;
};

export type WeightLog = {
  id: string;
  logged_on: string;
  weight_kg: number;
  body_fat_pct: number | null;
  notes: string | null;
};

export type WaterLog = { id: string; logged_at: string; ml: number };

export type SummaryRow = {
  bucket: string;
  days_logged: number;
  meals: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  burned_kcal: number;
  active_min: number;
  water_ml: number;
  avg_weight_kg: number | null;
};

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; created_at: string };
export type ChatThread = { id: string; title: string; updated_at: string };
