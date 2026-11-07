import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isConfigured, pullDailyBurn, pullSleep, pullSteps, pullWorkouts } from "@/lib/google-health";
import { createClient } from "@/lib/supabase/server";

// The browser's local date, since "today" depends on where the user is
const bodySchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  days: z.number().int().min(1).max(90).default(14),
  // Minutes behind UTC, as the browser reports it (getTimezoneOffset)
  tzOffsetMin: z.number().int().min(-840).max(840).default(0),
});

/** Reads recent daily step totals, workouts and sleep from Google Health into the app. */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { data } = await (await createClient()).auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isConfigured()) return NextResponse.json({ synced: false });

  const { days, tzOffsetMin, ...today } = parsed.data;
  // Each part stands alone: one failing (a permission, a Google hiccup) must not hide the others
  const settle = async (name: string, run: () => Promise<boolean | null>) => {
    try {
      return { name, result: await run(), error: null };
    } catch (e) {
      return { name, result: false as const, error: e instanceof Error ? e.message.slice(0, 200) : "failed" };
    }
  };
  const workouts = await settle("workouts", () => pullWorkouts(userId, days));
  const others = await Promise.all([
    settle("steps", () => pullSteps(userId, days, today)),
    settle("sleep", () => pullSleep(userId, days)),
    // After workouts, so the daily entry only adds what workouts don't already cover
    settle("burn", () => pullDailyBurn(userId, days, today, tzOffsetMin)),
  ]);
  const all = [workouts, ...others];
  return NextResponse.json({
    synced: all.some((p) => p.result === true),
    // What went wrong, by part, so the app can say why something is empty
    problems: Object.fromEntries(all.filter((p) => p.error).map((p) => [p.name, p.error])),
  });
}
