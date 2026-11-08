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
