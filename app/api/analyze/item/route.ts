import { NextResponse } from "next/server";
import { splitItemText } from "@/lib/food-text";
import { lookupTextMeal } from "@/lib/meal-lookup";
import { addItemSchema, analyzeFieldsSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * Looks up one item typed in ("2 rotis", "paneer 100g", "dal") to add to a meal.
 * Same chain as the meal name box (saved result → vector search → USDA → AI, see lookupTextMeal),
 * so common foods are answered from the shared cache and every new answer is saved for the next person.
 * Returns the food items found; the caller adds them to the meal.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return NextResponse.json({ error: "Please sign in to add items." }, { status: 401 });

  const body = addItemSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid item." }, { status: 400 });

  // The name and portion go through the same checks as the meal form
  const ctx = analyzeFieldsSchema.safeParse(splitItemText(body.data.text));
  if (!ctx.success) return NextResponse.json({ error: ctx.error.issues[0]?.message ?? "Invalid item." }, { status: 400 });

  try {
    const { analysis, provider, source } = await lookupTextMeal(ctx.data, { seedItems: false }); // one row (and one embedding) for the item typed, none for its sub-items
    if (!analysis.is_food || !analysis.items.length) {
      return NextResponse.json({ error: "That doesn't look like a food or drink. Try something like “2 rotis”." }, { status: 422 });
    }
    // One typed item that came back as several parts is kept together under what was typed
    const group = analysis.items.length > 1 ? ctx.data.name.trim().replace(/^./, (c) => c.toUpperCase()) : undefined;
    const items = group ? analysis.items.map((it) => ({ ...it, group })) : analysis.items;
    return NextResponse.json({ items, insights: analysis.insights, provider, source });
  } catch (err) {
    console.error("add item failed", err);
    const status = (err as { status?: number })?.status;
    if (status === 429 || status === 503 || (err as Error).name === "TimeoutError" || (err as Error).name === "AbortError") {
      return NextResponse.json({ error: "The AI is busy right now. Please try again in a minute." }, { status: 429 });
    }
    return NextResponse.json({ error: "We couldn't find that item. Please try again." }, { status: 502 });
  }
}
