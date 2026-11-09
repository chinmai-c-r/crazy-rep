import { z } from "zod";
import { ACTIVITY_IDS, INTENSITIES } from "./activities";

// ─── Shared enums ───────────────────────────────────────────

export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export const sexSchema = z.enum(["male", "female"]);
export const activitySchema = z.enum(["sedentary", "light", "moderate", "active", "very_active"]);
export const goalSchema = z.enum(["lose", "maintain", "gain"]);
export const dietSchema = z.enum(["vegetarian", "eggetarian", "non_vegetarian", "vegan"]);
/** How a meal was estimated: AI from a photo, AI from the name, USDA FoodData Central, or a saved result. */
export const analysisSourceSchema = z.enum(["photo", "text", "cache", "usda"]);

// ─── Auth forms ─────────────────────────────────────────────

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));
const password = z.string().min(6, "Use at least 6 characters").max(72, "Use at most 72 characters");

export const signInSchema = z.object({ email, password });

export const signUpSchema = z.object({
  name: z.string().trim().max(60, "Keep it under 60 characters"),
  email,
  password,
});

export const resetRequestSchema = z.object({ email });

/** Body of /api/signup-check. */
export const signupCheckSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

// ─── Meal details typed next to the photo ───────────────────
// Name is required; everything else is optional.

/** Meal names need at least 3 letters or digits (any script); spaces and punctuation don't count. */
const MIN_NAME_CHARS = 3;
const mealName = z
  .string()
  .trim()
  .max(120, "Keep it under 120 characters")
  .refine((v) => (v.match(/[\p{L}\p{M}\p{N}]/gu) ?? []).length >= MIN_NAME_CHARS, `Enter at least ${MIN_NAME_CHARS} letters`);

export const mealDetailsSchema = z.object({
  name: mealName,
  portion: z.string().trim().max(120, "Keep it under 120 characters"),
  notes: z.string().trim().max(300, "Keep it under 300 characters"),
});

/** Server-side parse of the multipart fields; blank optionals become undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

export const analyzeFieldsSchema = z.object({
  name: mealName,
  portion: optionalText(120),
  notes: optionalText(300),
});

/** One item typed into "add an item" on the results screen ("2 rotis", "paneer 100g", "dal"). */
export const addItemSchema = z.object({
  text: z.string().trim().min(2, "Type an item, like “2 rotis”").max(120, "Keep it under 120 characters"),
});

// ─── Nutrition (Gemini output, saved meals) ─────────────────

/** Lenient number: coerces strings, clamps negatives, rounds to 0.1, falls back to 0. */
const amount = z.coerce
  .number()
  .catch(0)
  .transform((v) => (Number.isFinite(v) ? Math.max(0, Math.round(v * 10) / 10) : 0));

export const nutrientsSchema = z.object({
  calories: amount,
  protein_g: amount,
  carbs_g: amount,
  fat_g: amount,
  fiber_g: amount,
  sugar_g: amount,
  saturated_fat_g: amount,
  sodium_mg: amount,
  cholesterol_mg: amount,
});

export const foodItemSchema = nutrientsSchema.extend({
  name: z.string().trim().min(1).catch("Item"),
  portion: z.string().trim().catch(""),
  grams: amount,
});

const zeroNutrients = nutrientsSchema.parse({});

/** Validates and repairs the AI response so the UI never sees malformed numbers. */
export const analysisSchema = z.object({
  is_food: z.boolean().catch(true),
  meal_name: z.string().trim().min(1).max(120).catch("Meal"),
  items: z.array(foodItemSchema).catch([]),
  totals: nutrientsSchema.catch(zeroNutrients),
  health_score: z.coerce
    .number()
    .catch(5)
    .transform((v) => Math.min(10, Math.max(1, Math.round(v)))),
  confidence: z.coerce
    .number()
    .catch(0.5)
    .transform((v) => Math.min(1, Math.max(0, v))),
  insights: z
    .array(z.string().trim())
    .catch([])
    .transform((xs) => xs.filter(Boolean).slice(0, 3)),
});

/** Who produced the numbers (shown for attribution): AI, USDA FoodData Central, Indian Nutrient Databank or IFCT 2017. */
export const providerSchema = z.enum(["ai", "usda", "indb", "ifct"]);
export const analyzeResponseSchema = z.object({ analysis: analysisSchema, source: analysisSourceSchema, provider: providerSchema });

/** Strict check before writing a meal to the database. */
const stored = z.number().min(0).max(100_000);
export const mealWriteSchema = z.object({
  name: mealName,
  meal_type: mealTypeSchema,
  source: analysisSourceSchema.optional(),
  servings: z.number().min(0.25).max(20),
  calories: stored,
  protein_g: stored,
  carbs_g: stored,
  fat_g: stored,
  fiber_g: stored,
  sugar_g: stored,
  saturated_fat_g: stored,
  sodium_mg: stored,
  cholesterol_mg: stored,
});

// ─── Profile ────────────────────────────────────────────────

/** Number inputs arrive as strings; blank means "not set". */
const optionalNumber = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number(`${label} must be a number`).min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`).nullable(),
  );

const target = (min: number, max: number, label: string) =>
  z.coerce
    .number(`${label} must be a number`)
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`);

export const profileSchema = z.object({
  display_name: z.string().trim().max(60, "Keep it under 60 characters"),
  sex: z.preprocess((v) => (v === "" ? null : v), sexSchema.nullable()),
  age: optionalNumber(10, 120, "Age"),
  height_cm: optionalNumber(80, 260, "Height"),
  weight_kg: optionalNumber(25, 400, "Weight"),
  activity_level: activitySchema,
  goal: goalSchema,
  target_weight_kg: optionalNumber(25, 400, "Target weight"),
  weekly_rate_kg: optionalNumber(0.1, 1.5, "Pace"),
  // Vegetarian unless chosen otherwise (a blank or missing value means the default)
  diet: z.preprocess((v) => (v === "" || v === null || v === undefined ? "vegetarian" : v), dietSchema),
  calorie_goal: target(800, 10000, "Calories"),
  protein_goal_g: target(0, 1000, "Protein"),
  carbs_goal_g: target(0, 1500, "Carbs"),
  fat_goal_g: target(0, 500, "Fat"),
  water_goal_ml: target(500, 10000, "Water goal"),
});

// ─── Activity, weight and water logs ────────────────────────

/** Optional numeric input: blank → null. */
const blankToNull = (inner: z.ZodNumber) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), inner.nullable());

export const activityLogSchema = z.object({
  activity: z.enum(ACTIVITY_IDS),
  intensity: z.enum(INTENSITIES),
  duration_min: target(1, 1440, "Duration"),
  calories_burned: z.coerce.number("Calories must be a number").min(0, "Calories can't be negative").max(20000, "That's too many calories"),
  distance_km: blankToNull(z.number("Distance must be a number").min(0, "Distance can't be negative").max(1000, "Distance looks too large")),
  steps: blankToNull(z.number("Steps must be a number").int("Steps must be a whole number").min(0).max(200000, "Steps look too high")),
  performed_at: z.string().min(1, "Pick a time"),
  notes: z.string().trim().max(300, "Keep it under 300 characters"),
});

export const weightLogSchema = z.object({
  logged_on: z.iso.date("Pick a date"),
  weight_kg: z.coerce.number("Weight must be a number").min(25, "Weight must be at least 25 kg").max(400, "Weight must be at most 400 kg"),
  body_fat_pct: blankToNull(z.number("Body fat must be a number").min(2, "Body fat must be at least 2%").max(75, "Body fat must be at most 75%")),
  notes: z.string().trim().max(300, "Keep it under 300 characters"),
});

export const waterLogSchema = z.object({ ml: z.number().int().min(1).max(5000) });

// ─── Coach chat ─────────────────────────────────────────────

export const chatRequestSchema = z.object({
  /** Omit to start a new conversation. */
  threadId: z.uuid().optional(),
  message: z.string().trim().min(1, "Type a message").max(1000, "Keep messages under 1000 characters"),
  tz: z.string().trim().min(1).max(64).default("UTC"),
});

// ─── Access requests (landing page) ─────────────────────────

export const accessRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email").max(254, "Email is too long")),
  name: z.string().trim().max(80, "Keep it under 80 characters"),
  message: z.string().trim().max(500, "Keep it under 500 characters"),
  /** Honeypot: hidden from people, filled in by bots. */
  website: z.string().max(200).optional(),
});

// ─── Inferred types ─────────────────────────────────────────

export type Nutrients = z.output<typeof nutrientsSchema>;
export type FoodItem = z.output<typeof foodItemSchema>;
export type Analysis = z.output<typeof analysisSchema>;
export type AnalysisSource = z.output<typeof analysisSourceSchema>;
export type MealDetails = z.output<typeof mealDetailsSchema>;
export type ProfileInput = z.input<typeof profileSchema>;
export type ProfileValues = z.output<typeof profileSchema>;
export type ActivityLogInput = z.input<typeof activityLogSchema>;
export type ActivityLogValues = z.output<typeof activityLogSchema>;
export type WeightLogInput = z.input<typeof weightLogSchema>;
export type WeightLogValues = z.output<typeof weightLogSchema>;
