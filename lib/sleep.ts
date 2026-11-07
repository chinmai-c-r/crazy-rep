type SleepPoint = {
  name?: string;
  sleep?: {
    interval?: { startTime?: string; endTime?: string; endUtcOffset?: string };
    summary?: {
      minutesInSleepPeriod?: number | string;
      minutesAsleep?: number | string;
      minutesAwake?: number | string;
      stagesSummary?: { light?: number | string; deep?: number | string; rem?: number | string; awake?: number | string };
    };
    metadata?: { nap?: boolean };
  };
};

const num = (v: unknown) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) && n >= 0 && n <= 2880 ? Math.round(n) : null;
};

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

  const stages = s?.summary?.stagesSummary;
  const inBed = num(s?.summary?.minutesInSleepPeriod) ?? Math.round((Date.parse(end) - Date.parse(start)) / 60000);
  const awake = num(s?.summary?.minutesAwake) ?? num(stages?.awake) ?? 0;
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
    deep_min: num(stages?.deep),
    light_min: num(stages?.light),
    rem_min: num(stages?.rem),
  };
}

/** 435 -> "7h 15m", 45 -> "45m". */
export const fmtSleep = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ""}` : `${min}m`);
