import { connection, NextResponse } from "next/server";
import { pushConfigured, sendPush } from "@/lib/push-server";
import { createClient } from "@/lib/supabase/server";

/** Sends a test notification to the signed-in user's own devices, so they can check reminders work. */
export async function POST() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: "Notifications aren't set up on this server yet." }, { status: 503 });

  const { data: subs } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (!subs?.length) return NextResponse.json({ error: "No device is registered. Turn reminders on first." }, { status: 404 });

  const results = await Promise.all(subs.map((s) => sendPush(s, { title: "Reminders are on ✅", body: "This is how your meal reminders will look. Tap to log a meal.", url: "/scan", tag: "meal-test" })));
  const gone = subs.filter((_, i) => results[i] === "gone").map((s) => s.id);
  if (gone.length) await supabase.from("push_subscriptions").delete().in("id", gone);

  const sent = results.filter((r) => r === "sent").length;
  if (!sent) return NextResponse.json({ error: "The notification couldn't be delivered. Try turning reminders off and on again." }, { status: 502 });
  return NextResponse.json({ sent });
}
