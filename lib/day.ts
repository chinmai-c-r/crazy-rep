import type { MealType } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** A local calendar day as "2026-11-06". */
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "2026-11-06" as that day at local midnight. null for anything else, a day that doesn't exist, or a day still to come. */
export function parseDay(text: string | null | undefined, now = new Date()): Date | null {
  const m = text?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (localDay(d) !== text) return null; // 2026-02-31 rolls over to March: not a real day
  return d.getTime() > new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() ? null : d;
}

/** "Today", "Yesterday", or "Thu, Nov 6". */
export function dayLabel(day: string, now = new Date()) {
  const d = parseDay(day, now);
  if (!d) return "Today";
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - d.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", ...(days > 300 ? { year: "numeric" } : {}) });
}

/** When people usually eat each meal. A meal logged for an earlier day is placed here, so it sorts sensibly and doesn't claim to be eaten "right now". */
const USUAL_TIME: Record<MealType, [hour: number, minute: number]> = { breakfast: [8, 30], lunch: [13, 0], snack: [16, 30], dinner: [20, 0] };

/** The timestamp to save for a meal on `day`: the current time for today (null: let the database stamp it), a usual mealtime for any earlier day. */
export function eatenAtFor(day: string, meal: MealType, now = new Date()): string | null {
  const d = parseDay(day, now);
  if (!d || localDay(d) === localDay(now)) return null;
  const [h, m] = USUAL_TIME[meal];
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
