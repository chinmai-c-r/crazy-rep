import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { deleteMeal, isConfigured, pushMeal } from "@/lib/google-health";
import { createAdmin, createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ mealId: z.uuid(), action: z.enum(["upsert", "delete"]) });

/**
 * Mirrors one meal to Google Health. The browser saves meals straight to Supabase,
 * then calls this. "delete" must run before the meal row is deleted, since the
 * Google Health entry id lives on that row.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isConfigured()) return NextResponse.json({ synced: false });

  // Read through the user's session so row-level security proves the meal is theirs
  const { data: meal } = await supabase.from("meals").select("*").eq("id", parsed.data.mealId).maybeSingle();
  if (!meal) return NextResponse.json({ error: "Meal not found." }, { status: 404 });

  if (parsed.data.action === "delete") {
    // The entry id is already in hand, so the Google call (token refresh and all) runs after the answer is sent
    // and deleting the meal doesn't wait on it
    const entryId = meal.google_health_id;
    if (entryId) after(() => deleteMeal(userId, entryId).catch((err) => console.warn("Google Health delete failed", (err as Error).message)));
    return NextResponse.json({ synced: true });
  }

  const result = await pushMeal(userId, meal);
  if (!result.connected) return NextResponse.json({ synced: false });
  if (!result.ok) return NextResponse.json({ error: "Could not sync to Google Health." }, { status: 502 });

  // The user's session isn't needed to store the entry id, and a failure here only costs a duplicate on the next edit
  await createAdmin().from("meals").update({ google_health_id: result.id }).eq("id", meal.id).eq("user_id", userId);
  return NextResponse.json({ synced: true });
}
