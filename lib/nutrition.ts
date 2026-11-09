import type { ActivityLevel, Goal, Nutrients, Sex } from "./types";
import { NUTRIENT_KEYS } from "./types";
import { CALORIE_FLOOR, dailyDelta } from "./weight-plan";

const ACTIVITY: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (little or no exercise)",
  light: "Light (1–3 days/week)",
  moderate: "Moderate (3–5 days/week)",
  active: "Active (6–7 days/week)",
  very_active: "Very active (hard training daily)",
};

const GOAL_DELTA: Record<Goal, number> = { lose: -500, maintain: 0, gain: 300 };

/**
 * Daily targets from the Mifflin–St Jeor equation.
 * Protein 1.8 g/kg (2.2 when cutting), fat 25% of calories, carbs fill the rest.
 */
export function calculateGoals(input: {
  sex: Sex;
  age: number;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal: Goal;
  /** Chosen pace in kg per week; sets the calorie gap instead of the fixed default */
  weekly_rate_kg?: number | null;
}) {
  const { sex, age, height_cm, weight_kg, activity_level, goal, weekly_rate_kg } = input;
  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (sex === "male" ? 5 : -161);
  const tdee = bmr * ACTIVITY[activity_level];
  const paced = goal !== "maintain" && weekly_rate_kg ? dailyDelta(weekly_rate_kg) * (goal === "lose" ? -1 : 1) : null;
  // With a chosen pace the floor is the safe minimum for their sex; the default plan keeps its old 1,200 floor
  const floor = paced === null ? 1200 : CALORIE_FLOOR[sex];
  const calories = Math.max(floor, Math.round((tdee + (paced ?? GOAL_DELTA[goal])) / 10) * 10);
  const protein = Math.round(weight_kg * (goal === "lose" ? 2.2 : 1.8));
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorie_goal: calories,
    protein_goal_g: protein,
    carbs_goal_g: carbs,
    fat_goal_g: fat,
  };
}

export function emptyNutrients(): Nutrients {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as Nutrients;
}

export function sumNutrients(rows: Nutrients[]): Nutrients {
  const total = emptyNutrients();
  for (const r of rows) for (const k of NUTRIENT_KEYS) total[k] += Number(r[k]) || 0;
  return total;
}

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  const out = emptyNutrients();
  for (const k of NUTRIENT_KEYS) out[k] = Math.round((Number(n[k]) || 0) * factor * 10) / 10;
  return out;
}

export function fmt(n: number, digits = 0) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
}

/** Local-day boundaries as ISO strings, so queries respect the user's timezone. */
export function dayRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function guessMealType(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 11) return "breakfast" as const;
  if (h >= 11 && h < 16) return "lunch" as const;
  if (h >= 17 && h < 22) return "dinner" as const;
  return "snack" as const;
}
