import { timingSafeEqual } from "node:crypto";
import { connection, NextResponse, type NextRequest } from "next/server";
import { pushConfigured, sendPush } from "@/lib/push-server";
import { sendDueReminders } from "@/lib/reminders-run";
import { createAdmin } from "@/lib/supabase/server";

const authorised = (request: NextRequest) => {
  const secret = process.env.REMINDERS_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
};

/**
 * Called once an hour by pg_cron (see supabase/migrations/…_meal_reminders.sql and …_reminders_hourly_and_cleanup.sql).
 * Works out who is due in their own timezone, skips meals already logged, and sends the pushes.
 */
export async function POST(request: NextRequest) {
  await connection();
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: "Push isn't configured" }, { status: 503 });

  try {
    return NextResponse.json(await sendDueReminders(createAdmin(), new Date(), sendPush));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
