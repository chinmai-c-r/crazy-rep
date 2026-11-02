import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { analysisSchema } from "./schemas";
import { NUTRIENT_KEYS } from "./types";

/** A primary model followed by fallbacks, trimmed and without blanks or repeats. */
const modelList = (primary: string, fallbacks: string) =>
  [primary, ...fallbacks.split(",")].map((m) => m.trim()).filter((m, i, all) => m && all.indexOf(m) === i);

/*
 * Every model has its own free quota, so a longer list is more capacity, not just more fallbacks. The free tier is
 * lopsided: full Flash models allow about 20 requests a day and 5 a minute, Flash Lite models 500 a day and 15 a minute.
 * So the order is quality first, then volume: when a Flash model is rate-limited the next one takes over.
 */

/** Photo and text analysis: full Flash models first, then Flash Lite when those are busy, used up for the day or retired. */
export const MODELS = modelList(
  process.env.GEMINI_MODEL || "gemini-3.8-flash",
  process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.6-flash,gemini-3.1-flash-lite,gemini-3.5-flash-lite",
);

/**
 * Coach chat. One message can take up to six calls (the model asks for data, reads it, asks again), which would
 * blow through a 5 a minute Flash limit, so it starts on Flash Lite (15 a minute) and keeps Flash as the fallback.
 */
export const COACH_MODELS = modelList(
  process.env.COACH_MODEL || "gemini-3.1-flash-lite",
  process.env.COACH_FALLBACK_MODELS ?? "gemini-3.5-flash-lite,gemini-3.8-flash,gemini-3.6-flash",
);

/** Stay inside the route's 60s maxDuration. */
const TOTAL_BUDGET_MS = 50_000;
const ATTEMPT_TIMEOUT_MS = 25_000;
const RETRYABLE = new Set([404, 408, 429, 500, 502, 503, 504]);

/** Errors worth retrying on the next model (overload, rate limit, retired model, timeout, bad JSON). */
export function isRetryable(err: unknown) {
  const status = (err as { status?: number }).status;
  const name = (err as Error).name;
  return name === "TimeoutError" || name === "AbortError" || err instanceof SyntaxError || Boolean(status && RETRYABLE.has(status));
}

/** Gemini 3+ takes a thinking level; 2.x takes a token budget. */
export const thinkingFor = (model: string) =>
  /^gemini-2\./.test(model) ? { thinkingBudget: 1024 } : { thinkingLevel: ThinkingLevel.LOW };

export function getAI() {
  ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

let ai: GoogleGenAI | undefined;

const nutrientProps = {
  calories: { type: "number", description: "kcal" },
  protein_g: { type: "number" },
  carbs_g: { type: "number" },
  fat_g: { type: "number" },
  fiber_g: { type: "number" },
  sugar_g: { type: "number" },
  saturated_fat_g: { type: "number" },
  sodium_mg: { type: "number" },
  cholesterol_mg: { type: "number" },
};

const schema = {
  type: "object",
  properties: {
    is_food: { type: "boolean", description: "false if the image does not show food or drink" },
    meal_name: { type: "string", description: "Short, appetising name for the whole meal" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          portion: { type: "string", description: "Human-readable portion, e.g. '1 cup' or '2 slices'" },
          grams: { type: "number", description: "Estimated weight in grams" },
          ...nutrientProps,
        },
        required: ["name", "portion", "grams", ...NUTRIENT_KEYS],
      },
    },
    totals: { type: "object", properties: nutrientProps, required: NUTRIENT_KEYS },
    health_score: { type: "integer", minimum: 1, maximum: 10, description: "1 = very unhealthy, 10 = very healthy" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    insights: {
      type: "array",
      items: { type: "string" },
      description: "2–3 short, practical nutrition tips about this meal",
    },
  },
  required: ["is_food", "meal_name", "items", "totals", "health_score", "confidence", "insights"],
};

const RULES = `- Use standard nutrition references (USDA FoodData Central, IFCT for Indian dishes) for per-gram values.
- "totals" must equal the sum of all items.
- Keep insights short (max 15 words each) and actionable.`;

const PHOTO_PROMPT = `You are a registered dietitian and food-recognition expert.
Analyse the meal in the photo and estimate its nutrition as accurately as possible.

Rules:
- Identify every distinct food and drink that is visible. Split mixed dishes into main components when that improves accuracy.
- Estimate portion sizes using visual cues (plate ~26 cm, cutlery, hands, packaging). Include cooking oils, sauces and dressings you can reasonably infer.
- If the photo contains no food or drink, set is_food to false, return an empty items array and zeros.
${RULES}`;

const TEXT_PROMPT = `You are a registered dietitian.
There is no photo. Estimate the nutrition of the meal described below as accurately as possible.

Rules:
- Break the dish into its typical components with realistic weights in grams.
- If no portion is given, assume one standard single-person serving as commonly eaten (state it in "portion").
- Include typical cooking oil, butter or ghee for the dish unless the notes say otherwise.
- If the description is clearly not a food or drink, set is_food to false, return an empty items array and zeros.
- Text-only estimates are less certain than photos: keep confidence at or below 0.7.
${RULES}`;


/** Optional details the user typed next to the photo. */
export type MealContext = { name?: string; portion?: string; notes?: string };

function contextText(ctx: MealContext, hasPhoto: boolean) {
  const lines = [
    ctx.name && `- Meal / dish name: ${ctx.name}`,
    ctx.portion && `- Portion or quantity: ${ctx.portion}`,
    ctx.notes && `- Notes (ingredients, cooking method, brand): ${ctx.notes}`,
  ].filter(Boolean);
  if (!lines.length) return "";
  const trust = hasPhoto ? "Trust them over visual guesses, and use" : "Use";
  return `\n\nThe user provided these details. ${trust} the dish name for meal_name if given:\n${lines.join("\n")}`;
}

/**
 * Estimates nutrition from a photo (most accurate) or from the meal details alone.
 * Returns the validated analysis and the model that produced it.
 */
export async function analyzeMeal(image: { data: string; mimeType: string } | null, ctx: MealContext = {}) {
  const parts = image
    ? [{ inlineData: image }, { text: PHOTO_PROMPT + contextText(ctx, true) }]
    : [{ text: TEXT_PROMPT + contextText(ctx, false) }];
  const ai = getAI();
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastError: unknown;

  for (const model of MODELS) {
    const remaining = deadline - Date.now();
    if (remaining < 5_000) break;
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          temperature: 0.2,
          thinkingConfig: thinkingFor(model),
          abortSignal: AbortSignal.timeout(Math.min(ATTEMPT_TIMEOUT_MS, remaining)),
        },
      });
      const text = response.text;
      if (!text) throw Object.assign(new Error("The AI returned an empty response"), { status: 502 });
      return { analysis: normalise(JSON.parse(text)), model };
    } catch (err) {
      lastError = err;
      console.warn(`gemini ${model} failed`, (err as { status?: number }).status ?? (err as Error).name, (err as Error).message?.slice(0, 200));
      if (!isRetryable(err)) throw err;
    }
  }
  throw lastError ?? new Error("All Gemini models failed");
}

/** Validates the AI output with zod, then recomputes totals from the items so they always add up. */
function normalise(raw: unknown) {
  const a = analysisSchema.parse(raw);
  if (a.items.length) {
    for (const k of NUTRIENT_KEYS) a.totals[k] = Math.round(a.items.reduce((s, it) => s + it[k], 0) * 10) / 10;
  }
  return a;
}
