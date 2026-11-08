type SleepPoint = {
  name?: string;
  sleep?: {
    interval?: { startTime?: string; endTime?: string; endUtcOffset?: string };
    summary?: {
      minutesInSleepPeriod?: number | string;
      minutesAsleep?: number | string;
      minutesAwake?: number | string;
      stagesSummary?: unknown;
    };
    metadata?: { nap?: boolean };
    type?: string;
    stages?: { type?: string; startTime?: string; endTime?: string }[];
  };
};

const num = (v: unknown) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) && n >= 0 && n <= 2880 ? Math.round(n) : null;
};

type Minutes = { deep: number | null; light: number | null; rem: number | null; awake: number | null };

/** "DEEP", "deep" and "Deep sleep" are the same stage. */
const stageOf = (name: unknown): keyof Minutes | null => {
  const n = String(name ?? "").toUpperCase();
  if (n.includes("DEEP")) return "deep";
  if (n.includes("LIGHT")) return "light";
  if (n.includes("REM")) return "rem";
  if (n.includes("AWAKE") || n.includes("WAKE")) return "awake";
  return null;
};

/** Minutes from a number, "90", "5400s", or an object like { minutes: 90 } / { duration: "5400s" }. */
function minutesOf(v: unknown): number | null {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return minutesOf(o.minutes ?? o.durationMinutes ?? o.duration ?? o.seconds);
  }
  if (typeof v === "string" && v.trim().endsWith("s")) {
    const sec = Number.parseFloat(v);
    return Number.isFinite(sec) ? Math.round(sec / 60) : null;
  }
  return num(v);
}

/**
 * Time in each stage. Google can describe it as a summary object ({ deep: 90 }), a list ([{ type: "DEEP", minutes: 90 }]),
 * or only as the individual stage periods, so all three are understood.
 */
export function stageMinutes(sleep: SleepPoint["sleep"]): Minutes {
  const out: Minutes = { deep: null, light: null, rem: null, awake: null };
  const summary = sleep?.summary?.stagesSummary;
  const add = (stage: keyof Minutes | null, min: number | null) => {
    if (stage && min !== null) out[stage] = (out[stage] ?? 0) + min;
  };
  if (Array.isArray(summary)) for (const item of summary) add(stageOf((item as { type?: unknown })?.type), minutesOf(item));
  else if (summary && typeof summary === "object") for (const [k, v] of Object.entries(summary)) add(stageOf(k), minutesOf(v));

  if (out.deep === null && out.light === null && out.rem === null) {
    for (const st of sleep?.stages ?? []) {
      const ms = Date.parse(st.endTime ?? "") - Date.parse(st.startTime ?? "");
      if (Number.isFinite(ms) && ms > 0) add(stageOf(st.type), Math.round(ms / 60000));
    }
  }
  return out;
}

/** The local date a session ended on, using the UTC offset Google reports for the end time ("-14400s"). */
export function wakeDay(endIso: string, offset?: string) {
  const seconds = Number.parseFloat(offset ?? "") || 0;
  return new Date(Date.parse(endIso) + seconds * 1000).toISOString().slice(0, 10);
}

/** One Google Health sleep session as a sleep_sessions row, or null if it lacks times or any sleep. */
export function sleepFromPoint(p: SleepPoint) {
  const s = p.sleep;
  const start = s?.interval?.startTime;
  const end = s?.interval?.endTime;
  if (!p.name || !start || !end || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) return null;

  const stages = stageMinutes(s);
  const inBed = num(s?.summary?.minutesInSleepPeriod) ?? Math.round((Date.parse(end) - Date.parse(start)) / 60000);
  const awake = num(s?.summary?.minutesAwake) ?? stages.awake ?? 0;
  // Older "classic" sleep has no total asleep: it's the time in bed minus the time awake
  const asleep = num(s?.summary?.minutesAsleep) ?? Math.max(0, inBed - awake);
  if (asleep <= 0 || inBed > 2880) return null;

  return {
    google_health_id: p.name.split("/").pop()!,
    day: wakeDay(end, s?.interval?.endUtcOffset),
    started_at: new Date(start).toISOString(),
    ended_at: new Date(end).toISOString(),
    nap: Boolean(s?.metadata?.nap),
    in_bed_min: inBed,
    asleep_min: Math.min(asleep, 2880),
    awake_min: awake,
    deep_min: stages.deep,
    light_min: stages.light,
    rem_min: stages.rem,
  };
}

/** 435 -> "7h 15m", 45 -> "45m". */
export const fmtSleep = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ""}` : `${min}m`);

// ─── Nights, scores and comparisons ─────────────────────────

export type SleepRow = {
  google_health_id: string;
  day: string;
  started_at: string;
  ended_at: string;
  nap: boolean;
  asleep_min: number;
  in_bed_min: number;
  awake_min: number;
  deep_min: number | null;
  light_min: number | null;
  rem_min: number | null;
};

/** One night: the main sleep that ended on `day`, with the day's naps added up separately. */
export type Night = {
  day: string;
  start: string;
  end: string;
  asleep: number;
  inBed: number;
  awake: number;
  deep: number | null;
  light: number | null;
  rem: number | null;
  napMin: number;
  score: number;
};

export const SLEEP_GOAL_MIN = 8 * 60;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/**
 * Our own 0-100 estimate of how restful a night was (not a medical measure). How long you slept comes first: it sets a ceiling
 * (8 hours reaches 100, 7 hours about 84, 6 about 69, 4 about 40), and the quality of the sleep decides how much of that ceiling
 * you get: time in bed actually spent asleep (40% of quality) and the share in deep and REM sleep (60%). A short night can't score
 * well however good its stages were. Without stage data, quality is just the first part.
 */
export function sleepScore(n: Pick<Night, "asleep" | "inBed" | "deep" | "rem">) {
  const length = Math.pow(clamp(n.asleep / SLEEP_GOAL_MIN), 1.3);
  const efficiency = n.inBed > 0 ? clamp((n.asleep / n.inBed - 0.75) / (0.92 - 0.75)) : 0;
  const hasStages = (n.deep ?? 0) + (n.rem ?? 0) > 0;
  const restorative = clamp((((n.deep ?? 0) + (n.rem ?? 0)) / Math.max(n.asleep, 1)) / 0.4);
  const quality = hasStages ? 0.4 * efficiency + 0.6 * restorative : efficiency;
  return Math.round(100 * length * (0.7 + 0.3 * quality));
}

export const scoreLabel = (score: number) => (score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : "Poor");

/** A nap: sleep marked as a nap. Listed on its own so it shows even on a day with no night. */
export type Nap = { start: string; end: string; min: number };

export function napsOf(rows: SleepRow[], day: string): Nap[] {
  return rows
    .filter((r) => r.day === day && r.nap)
    .map((r) => ({ start: r.started_at, end: r.ended_at, min: r.asleep_min }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** One Night per day, oldest first. The longest non-nap session is the night; a day with only naps has no night. */
export function nightsOf(rows: SleepRow[]): Night[] {
  const byDay = new Map<string, SleepRow[]>();
  for (const r of rows) byDay.set(r.day, [...(byDay.get(r.day) ?? []), r]);
  const out: Night[] = [];
  for (const [day, list] of byDay) {
    const main = list.filter((r) => !r.nap).sort((a, b) => b.asleep_min - a.asleep_min)[0];
    if (!main) continue;
    const night = {
      day,
      start: main.started_at,
      end: main.ended_at,
      asleep: main.asleep_min,
      inBed: main.in_bed_min,
      awake: main.awake_min,
      deep: main.deep_min,
      light: main.light_min,
      rem: main.rem_min,
      napMin: list.filter((r) => r.nap).reduce((s, r) => s + r.asleep_min, 0),
    };
    out.push({ ...night, score: sleepScore(night) });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

/** Average of a number across nights (ignoring nights without it), or null. */
export function averageOf(nights: Night[], pick: (n: Night) => number | null) {
  const xs = nights.map(pick).filter((v): v is number => v !== null);
  return xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) / xs.length) : null;
}

/** "+32m" or "−1h 05m": how much more or less than usual. */
export function fmtDelta(min: number) {
  const sign = min < 0 ? "−" : "+";
  const abs = Math.abs(min);
  return `${sign}${abs >= 60 ? `${Math.floor(abs / 60)}h ${String(abs % 60).padStart(2, "0")}m` : `${abs}m`}`;
}

/** Nights averaged into weeks (starting Monday) or months, for long ranges where a bar per night is too thin. `day` becomes the period's first day. */
export function groupNights(nights: Night[], bucket: "day" | "week" | "month"): Night[] {
  if (bucket === "day") return nights;
  const keyOf = (day: string) => {
    if (bucket === "month") return `${day.slice(0, 7)}-01`;
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const groups = new Map<string, Night[]>();
  for (const n of nights) groups.set(keyOf(n.day), [...(groups.get(keyOf(n.day)) ?? []), n]);
  return [...groups].map(([day, list]) => {
    const avg = (pick: (n: Night) => number | null) => averageOf(list, pick);
    const merged = {
      day,
      start: list[0].start,
      end: list[list.length - 1].end,
      asleep: avg((n) => n.asleep) ?? 0,
      inBed: avg((n) => n.inBed) ?? 0,
      awake: avg((n) => n.awake) ?? 0,
      deep: avg((n) => n.deep),
      light: avg((n) => n.light),
      rem: avg((n) => n.rem),
      napMin: avg((n) => n.napMin) ?? 0,
    };
    return { ...merged, score: sleepScore(merged) };
  }).sort((a, b) => a.day.localeCompare(b.day));
}

/** Moving average over the last `window` values (fewer at the start). */
export const movingAverage = (values: number[], window = 7) => values.map((_, i) => {
  const slice = values.slice(Math.max(0, i - window + 1), i + 1);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
});
