import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isConfigured, pullSleep, pullSteps, pullWorkouts } from "@/lib/google-health";
import { createClient } from "@/lib/supabase/server";

// The browser's local date, since "today" depends on where the user is
const bodySchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  days: z.number().int().min(1).max(90).default(14),
});

/** Reads recent daily step totals, workouts and sleep from Google Health into the app. */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { data } = await (await createClient()).auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isConfigured()) return NextResponse.json({ synced: false });

  const { days, ...today } = parsed.data;
  const [result, workouts, sleep] = await Promise.all([pullSteps(userId, days, today), pullWorkouts(userId, days), pullSleep(userId, days)]);
  if (result === false || workouts === false || sleep === false) return NextResponse.json({ error: "Could not read Google Health." }, { status: 502 });
  return NextResponse.json({ synced: result === true || sleep === true });
}
