import type { Profile, Sex } from "./types";

/** Body details we need to set daily targets. A profile without them hasn't been through onboarding. */
export const isProfileComplete = (p: Pick<Profile, "sex" | "age" | "height_cm" | "weight_kg">) =>
  Boolean(p.sex && p.age && p.height_cm && p.weight_kg);

/** Starting values that fit most adults, so onboarding can be done with a couple of taps. */
export const BODY_SUGGESTION: Record<Sex, { age: number; height_cm: number; weight_kg: number }> = {
  male: { age: 28, height_cm: 175, weight_kg: 72 },
  female: { age: 28, height_cm: 162, weight_kg: 58 },
};

/** About 35 ml per kg of body weight, rounded to 50 ml. */
export const waterGoalFor = (weightKg: number) => Math.min(5000, Math.max(1500, Math.round((weightKg * 35) / 50) * 50));

/** Fat is 25% of calories and carbs fill what's left after protein and fat (same rule as calculateGoals). */
export function macrosFor(calories: number, proteinG: number) {
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - proteinG * 4 - fat * 9) / 4));
  return { fat_goal_g: fat, carbs_goal_g: carbs };
}
