import type { SupabaseClient } from "@supabase/supabase-js";
import { dueMeals, localTime, loggedToday, messageFor, type ReminderMeal, type ReminderMessage, type ReminderSettings } from "./reminders";

type Device = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
export type Sender = (device: Device, message: ReminderMessage) => Promise<"sent" | "gone" | "failed">;
type Row = ReminderSettings & { user_id: string };

/**
 * Works out whose reminders are due right now (in their own timezone), skips meals already logged,
 * and sends the rest. Takes the database client and the sender so it can be tested without either.
 */
export async function sendDueReminders(admin: SupabaseClient, now: Date, send: Sender) {
  const { data: settings, error } = await admin.from("reminder_settings").select("*").eq("enabled", true);
  if (error) throw new Error(error.message);

  const due = ((settings ?? []) as Row[]).map((s) => ({ s, meals: dueMeals(s, now) })).filter((d) => d.meals.length > 0);
  if (!due.length) return { due: 0, sent: 0, removed: 0 };

  const ids = due.map((d) => d.s.user_id);
  const [{ data: meals }, { data: subs }] = await Promise.all([
    admin.from("meals").select("user_id, meal_type, eaten_at").in("user_id", ids).gte("eaten_at", new Date(now.getTime() - 36 * 3600_000).toISOString()),
    admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", ids),
  ]);

  let sent = 0;
  const gone: string[] = [];

  for (const { s, meals: toSend } of due) {
    const { date: today } = localTime(now, s.timezone);
    const devices = ((subs ?? []) as Device[]).filter((d) => d.user_id === s.user_id);
    const mine = (meals ?? []).filter((m) => m.user_id === s.user_id);

    // Claim today's slots before sending, so an overlapping run can't send them twice
    const claimed: Partial<Record<ReminderMeal, string>> = { ...s.last_sent };
    for (const meal of toSend) claimed[meal] = today;
    await admin.from("reminder_settings").update({ last_sent: claimed }).eq("user_id", s.user_id);

    for (const meal of toSend) {
      if (loggedToday(mine, meal, s.timezone, today)) continue; // already logged: nothing to remind about
      const results = await Promise.all(devices.map((d) => send(d, messageFor(meal))));
      results.forEach((r, i) => {
        if (r === "sent") sent++;
        if (r === "gone") gone.push(devices[i].id);
      });
    }
  }

  // Devices that unsubscribed or were uninstalled
  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  return { due: due.length, sent, removed: gone.length };
}
