import { NextResponse } from "next/server";
import { z } from "zod";
import { embedTexts, toVector } from "@/lib/embeddings";
import { indexMeals } from "@/lib/meal-index";
import { createAdmin, createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const bodySchema = z.object({ mealId: z.uuid() });

/**
 * Links a just-saved meal to its dish in analysis_cache (adding the dish if it's new) and gives it a vector,
 * so it can be found by search. Called by the app right after a meal is saved; search also catches up on any it missed.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ linked: 0 });

  // Read through the user's session so row-level security proves the meal is theirs
  const { data: meal } = await supabase.from("meals").select("*").eq("id", parsed.data.mealId).maybeSingle();
  if (!meal) return NextResponse.json({ error: "Meal not found." }, { status: 404 });

  try {
    const linked = await indexMeals(createAdmin(), (texts) => embedTexts(texts, "RETRIEVAL_DOCUMENT", { retries: 1, timeoutMs: 20_000 }), toVector, userId, [meal]);
    return NextResponse.json({ linked });
  } catch (err) {
    console.warn("meal indexing failed", (err as Error).message);
    return NextResponse.json({ linked: 0 });
  }
}
