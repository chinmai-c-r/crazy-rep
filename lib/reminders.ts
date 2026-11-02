/** Meal reminders: shared by the settings card (browser) and the sender (server). No imports from either side. */

export const REMINDER_MEALS = ["breakfast", "lunch", "dinner"] as const;
export type ReminderMeal = (typeof REMINDER_MEALS)[number];

/** A column per meal; null means that meal has no reminder. Times are "HH:MM". */
export type ReminderSettings = {
  enabled: boolean;
  timezone: string;
  breakfast_at: string | null;
  lunch_at: string | null;
  dinner_at: string | null;
  last_sent: Partial<Record<ReminderMeal, string>>;
};

export const DEFAULT_REMINDER_TIMES: Record<ReminderMeal, string> = { breakfast: "08:30", lunch: "13:30", dinner: "20:00" };

export const REMINDER_LABELS: Record<ReminderMeal, { label: string; icon: string }> = {
  breakfast: { label: "Breakfast", icon: "🍳" },
  lunch: { label: "Lunch", icon: "🥗" },
  dinner: { label: "Dinner", icon: "🍝" },
};

/** The database returns times as "08:30:00"; the app uses "08:30". */
export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);

const minutesOf = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * A reminder still goes out for this long after its time, so a slow or missed scheduler run
 * doesn't lose it. After that the moment has passed and it's skipped.
 */
export const GRACE_MINUTES = 90;

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The local date ("2026-11-03") and minutes since midnight at `at` in a timezone. An unknown timezone falls back to UTC. */
export function localTime(at: Date | number | string, timeZone: string) {
  const key = timeZone;
  let f = formatters.get(key);
  if (!f) {
    const make = (tz: string) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    try {
      f = make(timeZone);
    } catch {
      f = make("UTC");
    }
    formatters.set(key, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** Which meals' reminders should go out now: their time has come, hasn't gone stale, and wasn't already sent today. */
export function dueMeals(s: ReminderSettings, now: Date): ReminderMeal[] {
  if (!s.enabled) return [];
  const { date, minutes } = localTime(now, s.timezone);
  return REMINDER_MEALS.filter((meal) => {
    const at = hhmm(s[`${meal}_at`]);
    if (!at) return false;
    const start = minutesOf(at);
    return minutes >= start && minutes < start + GRACE_MINUTES && s.last_sent?.[meal] !== date;
  });
}

/** True if one of these meals is of this type and was eaten on today's local date. */
export const loggedToday = (meals: { meal_type: string; eaten_at: string }[], meal: ReminderMeal, timeZone: string, today: string) =>
  meals.some((m) => m.meal_type === meal && localTime(m.eaten_at, timeZone).date === today);

export type ReminderMessage = { title: string; body: string; url: string; tag: string };

const COPY: Record<ReminderMeal, { title: string; body: string }> = {
  breakfast: { title: "Breakfast time 🍳", body: "Log what you're having. A photo or just the name takes seconds." },
  lunch: { title: "Lunch time 🥗", body: "Log your lunch while it's fresh. A photo or just the name is enough." },
  dinner: { title: "Dinner time 🍝", body: "Log your dinner to close out the day. It takes seconds." },
};

export const messageFor = (meal: ReminderMeal): ReminderMessage => ({ ...COPY[meal], url: `/scan?type=${meal}`, tag: `meal-${meal}` });
