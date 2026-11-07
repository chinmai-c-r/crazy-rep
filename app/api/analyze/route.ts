import { NextResponse } from "next/server";
import { dietOf, DEFAULT_DIET, fitInsights } from "@/lib/diet";
import { inBackground, seedItemRows } from "@/lib/analysis-cache";
import { analyzeMeal } from "@/lib/gemini";
import { lookupTextMeal } from "@/lib/meal-lookup";
import { analyzeFieldsSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/**
 * Estimates nutrition for a meal. The name is required; the photo is optional.
 * - With a photo: always calls the AI (every photo is different).
 * - Without a photo: saved result → USDA FoodData Central → AI (see lookupTextMeal).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    return NextResponse.json({ error: "Please sign in to analyse meals." }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const details = analyzeFieldsSchema.safeParse({
    name: form.get("name") ?? "",
    portion: form.get("portion") ?? undefined,
    notes: form.get("notes") ?? undefined,
  });
  if (!details.success) {
    return NextResponse.json({ error: details.error.issues[0]?.message ?? "Invalid meal details." }, { status: 400 });
  }
  const ctx = details.data;

  const file = form.get("image");
  const hasImage = file instanceof File && file.size > 0;
  if (hasImage) {
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Please upload a JPEG, PNG or WebP image." }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image is too large (max 5 MB)." }, { status: 413 });
    }
  }

  // The diet is read alongside the analysis. Reading the whole row keeps this working on a database without the diet column yet.
  const dietPromise = Promise.resolve(supabase.from("profiles").select("*").maybeSingle())
    .then(({ data }) => dietOf(data))
    .catch(() => DEFAULT_DIET);

  try {
    if (hasImage) {
      const data = Buffer.from(await file.arrayBuffer()).toString("base64");
      const diet = await dietPromise;
      // Photo analyses are never cached or shared, so the model can be told the diet and write tips for it
      const { analysis, model } = await analyzeMeal({ data, mimeType: file.type }, { ...ctx, diet });
      // The photo itself is never cached, but the foods in it are worth keeping for later "add item" lookups
      if (analysis.is_food) await inBackground(() => seedItemRows(analysis, model));
      return NextResponse.json({ analysis: { ...analysis, insights: fitInsights(diet, analysis.insights, analysis.totals) }, source: "photo", provider: "ai" });
    }

    // Text results come from a cache shared by everyone, so their tips are written for no diet; fit them to this person's
    const [result, diet] = await Promise.all([lookupTextMeal(ctx), dietPromise]);
    return NextResponse.json({ ...result, analysis: { ...result.analysis, insights: fitInsights(diet, result.analysis.insights, result.analysis.totals) } });
  } catch (err) {
    console.error("analyze failed", err);
    const status = (err as { status?: number })?.status;
    if (status === 429 || status === 503 || (err as Error).name === "TimeoutError" || (err as Error).name === "AbortError") {
      return NextResponse.json({ error: "The AI is busy right now. Please try again in a minute." }, { status: 429 });
    }
    return NextResponse.json({ error: "We couldn't analyse that meal. Please try again." }, { status: 502 });
  }
}
