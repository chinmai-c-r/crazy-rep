import type { Goal, Sex } from "./types";

/** Roughly 7,700 kcal per kg of body weight, so one kg a week is about 1,100 kcal a day. */
export const KCAL_PER_KG = 7700;
export const DAILY_KCAL_PER_WEEKLY_KG = KCAL_PER_KG / 7;
const WEEKS_PER_MONTH = 4.345;

/** Lowest daily intake we'll suggest without medical supervision. */
export const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };

export type Pace = { rate: number; label: string; hint: string };

export const PACES: Record<"lose" | "gain", Pace[]> = {
  lose: [
    { rate: 0.25, label: "Easy", hint: "Gentle, easy to keep up" },
    { rate: 0.5, label: "Steady", hint: "The sweet spot for most people" },
    { rate: 0.75, label: "Fast", hint: "Takes real discipline" },
    { rate: 1, label: "Aggressive", hint: "Hard to sustain, loses muscle" },
  ],
  gain: [
    { rate: 0.25, label: "Lean", hint: "Mostly muscle, little fat" },
    { rate: 0.5, label: "Quicker", hint: "Faster, with some extra fat" },
  ],
};

/** A pace that's safe and realistic for this body: about 0.5% of body weight a week when cutting. */
export function recommendedRate(goal: "lose" | "gain", weightKg: number) {
  if (goal === "gain") return 0.25;
  const wanted = weightKg * 0.005;
  return PACES.lose.slice(0, 3).reduce((best, p) => (Math.abs(p.rate - wanted) < Math.abs(best.rate - wanted) ? p : best)).rate;
}

/** Daily calories above or below maintenance that a weekly pace needs. */
export const dailyDelta = (ratePerWeek: number) => Math.round(ratePerWeek * DAILY_KCAL_PER_WEEKLY_KG);

/** Weights that fall in the healthy BMI range (18.5 to 24.9) for a height. */
export function healthyRange(heightCm: number) {
  const m = heightCm / 100;
  return { min: Math.ceil(18.5 * m * m), max: Math.floor(24.9 * m * m) };
}

export const bmiOf = (weightKg: number, heightCm: number) => weightKg / (heightCm / 100) ** 2;

/** A sensible first target: about 10% lighter (never under a healthy weight) or 5% heavier. */
export function suggestedTarget(goal: Goal, weightKg: number, heightCm: number) {
  if (goal === "gain") return Math.round(weightKg * 1.05);
  if (goal === "lose") return Math.max(Math.round(weightKg * 0.9), Math.min(Math.round(weightKg), healthyRange(heightCm).min));
  return Math.round(weightKg);
}

export type Level = "ok" | "caution" | "danger";
export type Note = { level: Level; text: string };

export type WeightPlan = {
  level: Level;
  notes: Note[];
  /** Pace the calories actually give, kg per week */
  rate: number;
  kgToGo: number;
  weeks: number | null;
  months: number | null;
  /** A gentler pace that would clear the warnings, when there is one */
  saferRate: number | null;
};

const worst = (notes: Note[]): Level => (notes.some((n) => n.level === "danger") ? "danger" : notes.some((n) => n.level === "caution") ? "caution" : "ok");

/**
 * Works out how long the goal takes at the calories given, and says plainly when the plan is too aggressive.
 * Returns null when there's nothing to plan (maintaining, or no target yet).
 */
export function assessPlan(input: {
  goal: Goal;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  target_kg: number | null;
  tdee: number;
  bmr: number;
  calories: number;
  /** The pace the user picked, if it differs from what the calories give */
  requestedRate?: number | null;
}): WeightPlan | null {
  const { goal, sex, height_cm, weight_kg, target_kg, tdee, bmr, calories, requestedRate } = input;
  if (goal === "maintain" || !target_kg) return null;

  const notes: Note[] = [];
  const losing = goal === "lose";
  const kgToGo = losing ? weight_kg - target_kg : target_kg - weight_kg;

  if (kgToGo < 0.5) {
    notes.push({
      level: "caution",
      text: losing ? `Your target of ${target_kg} kg isn't below your current weight. Pick a lower target, or switch your goal to maintain.` : `Your target of ${target_kg} kg isn't above your current weight. Pick a higher target, or switch your goal to maintain.`,
    });
    return { level: "caution", notes, rate: 0, kgToGo: Math.max(0, kgToGo), weeks: null, months: null, saferRate: null };
  }

  const rate = Math.max(0, (losing ? tdee - calories : calories - tdee) / DAILY_KCAL_PER_WEEKLY_KG);
  const weeks = rate >= 0.05 ? kgToGo / rate : null;
  const months = weeks === null ? null : weeks / WEEKS_PER_MONTH;
  const pct = (rate / weight_kg) * 100; // percent of body weight per week
  const floor = CALORIE_FLOOR[sex];
  const targetBmi = bmiOf(target_kg, height_cm);
  const range = healthyRange(height_cm);

  if (losing) {
    const wanted = requestedRate ? Math.round(tdee - dailyDelta(requestedRate)) : null;
    if (wanted !== null && wanted < floor)
      notes.push({
        level: "danger",
        text: `Losing ${requestedRate} kg a week would mean eating about ${wanted.toLocaleString()} kcal, below the ${floor.toLocaleString()} kcal minimum we'd ever suggest. We've capped your calories at ${calories.toLocaleString()}, which is closer to ${rate.toFixed(2)} kg a week.`,
      });
    else if (calories < floor)
      notes.push({ level: "danger", text: `${calories.toLocaleString()} kcal a day is below the ${floor.toLocaleString()} kcal minimum we'd suggest without a doctor's advice.` });
    if (pct > 1) notes.push({ level: "danger", text: `That's ${pct.toFixed(1)}% of your body weight a week. Over 1% a week mostly costs muscle, energy and mood, and is hard to keep up.` });
    else if (pct > 0.75 || (tdee - calories) / tdee > 0.25)
      notes.push({ level: "caution", text: "This is an aggressive pace. Expect real hunger and some muscle loss. Keep protein high and lift if you can." });
    if (calories < bmr && calories >= floor) notes.push({ level: "caution", text: `You'd eat less than your body burns at rest (about ${Math.round(bmr).toLocaleString()} kcal).` });
    if (targetBmi < 18.5)
      notes.push({ level: "danger", text: `${target_kg} kg is a BMI of ${targetBmi.toFixed(1)}, which is underweight for your height. A healthy range is ${range.min}–${range.max} kg.` });
    else if (bmiOf(weight_kg, height_cm) < 18.5) notes.push({ level: "danger", text: "You're already at the low end of a healthy weight. Losing more isn't advised. Consider maintaining instead." });
  } else {
    if (pct > 0.5 || rate > 0.5) notes.push({ level: "caution", text: "Gaining faster than about 0.5 kg a week mostly adds fat, not muscle." });
    if (targetBmi >= 30) notes.push({ level: "caution", text: `${target_kg} kg is a BMI of ${targetBmi.toFixed(1)}. A healthy range for your height is ${range.min}–${range.max} kg.` });
  }

  if (months !== null && months > 18) notes.push({ level: "caution", text: "That's a long road. Splitting it into a nearer milestone first can keep you motivated." });
  if (months === null) notes.push({ level: "caution", text: "At these calories you'd barely move. Adjust your calories or pick a faster pace." });
  if (!notes.length) notes.push({ level: "ok", text: losing ? "A steady, sustainable pace." : "A realistic pace for building muscle." });

  const level = worst(notes);
  const safer = recommendedRate(goal, weight_kg);
  return { level, notes, rate, kgToGo, weeks, months, saferRate: level !== "ok" && rate > safer ? safer : null };
}

/** "3 weeks", "about 4.5 months", "1 year 3 months". */
export function durationText(plan: Pick<WeightPlan, "weeks" | "months">) {
  if (plan.weeks === null || plan.months === null) return null;
  if (plan.weeks < 6) return `${Math.max(1, Math.round(plan.weeks))} week${Math.round(plan.weeks) === 1 ? "" : "s"}`;
  if (plan.months < 12) return `about ${(Math.round(plan.months * 2) / 2).toString()} months`;
  const years = Math.floor(plan.months / 12);
  const rest = Math.round(plan.months - years * 12);
  return `${years} year${years === 1 ? "" : "s"}${rest ? ` ${rest} month${rest === 1 ? "" : "s"}` : ""}`;
}

/** When the goal lands if you start today, like "Mar 2027". */
export function finishOn(weeks: number) {
  return new Date(Date.now() + weeks * 7 * 864e5).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}
