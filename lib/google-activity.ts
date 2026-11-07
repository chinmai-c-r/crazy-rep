import { ACTIVITIES, caloriesBurned, DEFAULT_WEIGHT_KG, type ActivityId, type Intensity } from "./activities";

type Exercise = {
  interval?: { startTime?: string; endTime?: string };
  exerciseType?: string;
  displayName?: string;
  activeDuration?: string;
  metricsSummary?: { caloriesKcal?: number | string; distanceMillimeters?: number | string; steps?: number | string };
};

/** Google Health names its exercise types in capitals (RUNNING, WALKING_TREADMILL, ...). Matched by keyword so new types still land somewhere sensible. */
const RULES: [RegExp, ActivityId][] = [
  [/WALK/, "walking"],
  [/RUN|JOG|TREADMILL/, "running"],
  [/BIK|CYCL|SPINNING/, "cycling"],
  [/WEIGHT|STRENGTH|CALISTHENICS|CROSSFIT/, "strength"],
  [/HIIT|INTERVAL|BOOT_CAMP|AEROBIC|CIRCUIT/, "hiit"],
  [/YOGA|PILATES|STRETCH/, "yoga"],
  [/SWIM/, "swimming"],
  [/HIK|CLIMB/, "hiking"],
  [/DANC|ZUMBA|BALLET/, "dancing"],
  [/BALL|TENNIS|BADMINTON|SQUASH|HOCKEY|RUGBY|CRICKET|GOLF|BOXING|MARTIAL|SKATING|SKIING|ROWING/, "sports"],
];

export const activityOfType = (type: string | undefined): ActivityId => RULES.find(([re]) => re.test(type ?? ""))?.[1] ?? "other";

const words = (type: string) => type.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** One Google Health exercise as an activity_logs row, or null if it has no usable time span. */
export function activityFromExercise(name: string, e: Exercise | undefined, weightKg?: number | null) {
  const start = e?.interval?.startTime;
  const end = e?.interval?.endTime;
  if (!e || !start || !end) return null;
  const active = Number.parseFloat(e.activeDuration ?? "");
  const seconds = active > 0 ? active : (Date.parse(end) - Date.parse(start)) / 1000;
  const duration_min = Math.min(1440, Math.max(1, Math.round(seconds / 60)));
  if (!Number.isFinite(duration_min)) return null;

  const activity = activityOfType(e.exerciseType);
  const m = e.metricsSummary ?? {};
  const kcal = Number(m.caloriesKcal);
  // Prefer the device's own calorie figure; otherwise estimate like a hand-logged activity
  const calories_burned = Number.isFinite(kcal) && kcal >= 0 ? Math.min(20000, Math.round(kcal)) : caloriesBurned(activity, "moderate", duration_min, weightKg ?? DEFAULT_WEIGHT_KG);
  const perMin = calories_burned / duration_min;
  const intensity: Intensity = perMin < 4 ? "light" : perMin < 9 ? "moderate" : "vigorous";
  const mm = Number(m.distanceMillimeters);
  const steps = Number(m.steps);
  const label = e.displayName?.trim() || (e.exerciseType ? words(e.exerciseType) : "");
  return {
    google_health_id: name.split("/").pop()!,
    performed_at: new Date(start).toISOString(),
    activity,
    intensity,
    duration_min,
    calories_burned,
    distance_km: mm > 0 && mm <= 1e9 ? Math.round(mm / 1e4) / 100 : null,
    steps: Number.isFinite(steps) && steps >= 0 && steps <= 200000 ? Math.round(steps) : null,
    // The app's categories are coarse: keep Google's own name for what it was
    notes: activity === "other" || (label && label.toLowerCase() !== ACTIVITIES[activity].label.toLowerCase()) ? `Google Health: ${label}`.slice(0, 300) : null,
  };
}
