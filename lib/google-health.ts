import "server-only";
import { createAdmin } from "@/lib/supabase/server";
import { activityFromExercise } from "@/lib/google-activity";
import { sleepFromPoint } from "@/lib/sleep";
import type { Meal } from "@/lib/types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://health.googleapis.com/v4/users/me";
const NUTRITION = `${API}/dataTypes/nutrition-log/dataPoints`;

export const SCOPE = "https://www.googleapis.com/auth/googlehealth.nutrition.writeonly";
// Only used to read Google's list of serving units, which every nutrition entry needs. We never read logged meals back.
export const NUTRITION_READ_SCOPE = "https://www.googleapis.com/auth/googlehealth.nutrition.readonly";
export const SLEEP_SCOPE = "https://www.googleapis.com/auth/googlehealth.sleep.readonly";
export const ACTIVITY_SCOPE = "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly";

export const isConfigured = () => Boolean(process.env.GOOGLE_HEALTH_CLIENT_ID && process.env.GOOGLE_HEALTH_CLIENT_SECRET);

export const redirectUri = (origin: string) => `${origin}/api/google-health/callback`;

export function authUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_HEALTH_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: `${SCOPE} ${NUTRITION_READ_SCOPE} ${ACTIVITY_SCOPE} ${SLEEP_SCOPE}`,
    access_type: "offline",
    // Always ask, so Google returns a refresh token even when the user reconnects
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_HEALTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET!,
      ...body,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; scope?: string; error?: string };
  return { ok: res.ok, json };
}

export async function exchangeCode(origin: string, code: string) {
  const { ok, json } = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri(origin) });
  return ok ? json : null;
}

/** Gets a fresh access token for the user, or null if they aren't connected (or revoked access). */
async function accessToken(userId: string) {
  const admin = createAdmin();
  const { data } = await admin.from("google_health_connections").select("refresh_token").eq("user_id", userId).maybeSingle();
  if (!data) return null;

  const { ok, json } = await tokenRequest({ refresh_token: data.refresh_token, grant_type: "refresh_token" });
  if (!ok || !json.access_token) {
    // The user revoked access (or the token expired): drop the dead connection
    if (json.error === "invalid_grant") await admin.from("google_health_connections").delete().eq("user_id", userId);
    return null;
  }
  return json.access_token;
}

type MealForSync = Pick<
  Meal,
  | "id"
  | "name"
  | "meal_type"
  | "eaten_at"
  | "calories"
  | "protein_g"
  | "carbs_g"
  | "fat_g"
  | "fiber_g"
  | "sugar_g"
  | "saturated_fat_g"
  | "sodium_mg"
  | "cholesterol_mg"
  | "servings"
> & { google_health_id: string | null };

function nutritionLog(m: MealForSync, unit: string) {
  const start = new Date(m.eaten_at);
  const end = new Date(start.getTime() + 60_000);
  const grams = (n: number) => ({ grams: Math.round(Number(n) * 1000) / 1000 });
  const nutrients = [
    { nutrient: "PROTEIN", quantity: grams(m.protein_g) },
    { nutrient: "DIETARY_FIBER", quantity: grams(m.fiber_g) },
    { nutrient: "SUGAR", quantity: grams(m.sugar_g) },
    { nutrient: "SATURATED_FAT", quantity: grams(m.saturated_fat_g) },
    { nutrient: "SODIUM", quantity: grams(Number(m.sodium_mg) / 1000) },
    { nutrient: "CHOLESTEROL", quantity: grams(Number(m.cholesterol_mg) / 1000) },
  ];
  return {
    nutritionLog: {
      interval: { startTime: start.toISOString(), endTime: end.toISOString() },
      foodDisplayName: m.name,
      mealType: m.meal_type.toUpperCase(),
      energy: { kcal: Number(m.calories) },
      energyFromFat: { kcal: Math.round(Number(m.fat_g) * 9) },
      totalCarbohydrate: grams(m.carbs_g),
      totalFat: grams(m.fat_g),
      nutrients,
      serving: { amount: Number(m.servings), foodMeasurementUnit: unit },
    },
  };
}

async function api(token: string, url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) console.error("google health api", res.status, JSON.stringify(json));
  return { ok: res.ok, json };
}

const UNIT_PREFERENCE = ["serving", "piece", "portion", "unit", "gram"];
// "piece", the unit in Google's own nutrition-log example. Used when we're not allowed to list units (that needs the nutrition read scope).
const FALLBACK_UNIT = "users/me/dataTypes/food-measurement-unit/dataPoints/251";
let unitName: string | undefined;
let cannotListUntil = 0; // retried after a few minutes, since the user may have just reconnected with the read permission

const strings = (v: unknown): string[] => (typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : []);

/**
 * Google Health wants a serving unit on every nutrition entry, and units are its own records ("users/me/dataTypes/food-measurement-unit/dataPoints/251").
 * The calories and nutrients we send are totals, so the unit is only a label: "serving" fits best, with a few fallbacks.
 */
async function servingUnit(token: string) {
  if (unitName) return unitName;
  if (Date.now() < cannotListUntil) return FALLBACK_UNIT;
  const res = await fetch(`${API}/dataTypes/food-measurement-unit/dataPoints?pageSize=1000`, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json().catch(() => ({}));
  if (res.status === 403) {
    // Only the write permission was granted: listing units isn't allowed, so use the known one
    cannotListUntil = Date.now() + 5 * 60_000;
    return FALLBACK_UNIT;
  }
  if (!res.ok) {
    console.error("google health api", res.status, JSON.stringify(json));
    return null;
  }
  const points = (json.dataPoints ?? []) as { name?: string }[];
  for (const want of UNIT_PREFERENCE) {
    const hit = points.find((p) => p.name && strings({ ...p, name: undefined }).some((v) => v.toLowerCase() === want));
    if (hit?.name) return (unitName = hit.name);
  }
  console.error("google health: no usable food measurement unit", JSON.stringify(points.slice(0, 5)));
  return null;
}

async function removeRemote(token: string, id: string) {
  // Entries from anonymous foods can't be updated and have no single-item delete
  await api(token, `${NUTRITION}:batchDelete`, { names: [`users/me/dataTypes/nutrition-log/dataPoints/${id}`] });
}

/** Writes the meal to Google Health, replacing the previous entry if there is one. Returns the new entry id. */
export async function pushMeal(userId: string, meal: MealForSync, knownToken?: string) {
  const token = knownToken ?? (await accessToken(userId));
  if (!token) return { connected: false as const };

  const unit = await servingUnit(token);
  if (!unit) return { connected: true as const, ok: false, id: null };

  if (meal.google_health_id) await removeRemote(token, meal.google_health_id);

  const { ok, json } = await api(token, NUTRITION, nutritionLog(meal, unit));
  // The response is a long-running operation wrapper: { done, response: DataPoint }
  const name: string | undefined = json?.response?.name ?? json?.name;
  const id = name?.split("/").pop();
  return { connected: true as const, ok: ok && Boolean(id), id: id ?? null };
}

/**
 * Sends meals that were never sent (no Google Health id), oldest first, up to `limit`.
 * Meals that already have an id are never touched, so running this again can't duplicate anything.
 * Returns null when not connected, "busy" when another run is in progress.
 */
export async function backfillMeals(
  userId: string,
  list: (limit: number) => Promise<MealForSync[]>,
  limit: number,
) {
  const admin = createAdmin();
  // Claim the run: only one at a time per user (a claim older than a minute is a run that died)
  const stale = new Date(Date.now() - 60_000).toISOString();
  const { data: claimed } = await admin
    .from("google_health_connections")
    .update({ backfill_at: new Date().toISOString() })
    .eq("user_id", userId)
    .or(`backfill_at.is.null,backfill_at.lt.${stale}`)
    .select("user_id");
  if (!claimed?.length) {
    const { data: conn } = await admin.from("google_health_connections").select("user_id").eq("user_id", userId).maybeSingle();
    return conn ? ("busy" as const) : null;
  }

  try {
    const token = await accessToken(userId);
    if (!token) return null;
    let sent = 0;
    let failed = 0;
    for (const meal of await list(limit)) {
      const result = await pushMeal(userId, meal, token);
      if (!result.connected || !result.ok || !result.id) {
        failed++;
        continue;
      }
      const { error } = await admin.from("meals").update({ google_health_id: result.id }).eq("id", meal.id).eq("user_id", userId);
      if (error) {
        // Couldn't record it: take the entry back out so the next run doesn't send it a second time
        await removeRemote(token, result.id);
        failed++;
      } else sent++;
    }
    return { sent, failed };
  } finally {
    await admin.from("google_health_connections").update({ backfill_at: null }).eq("user_id", userId);
  }
}

export async function deleteMeal(userId: string, googleHealthId: string) {
  const token = await accessToken(userId);
  if (!token) return false;
  await removeRemote(token, googleHealthId);
  return true;
}

type CivilDate = { year: number; month: number; day: number };
const civil = (d: CivilDate) => ({ date: d, time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 } });
const dayKey = (d: CivilDate) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

/**
 * Reads daily step totals for the last `days` days (today included) and stores them.
 * Days are the user's local days as Google Health reports them. Returns null when not connected or the
 * connection lacks the activity permission, and false if Google Health failed.
 */
export async function pullSteps(userId: string, days: number, today: CivilDate) {
  const admin = createAdmin();
  const { data: conn } = await admin.from("google_health_connections").select("scopes").eq("user_id", userId).maybeSingle();
  if (!conn?.scopes.split(" ").includes(ACTIVITY_SCOPE)) return null;
  const token = await accessToken(userId);
  if (!token) return null;

  const first = new Date(Date.UTC(today.year, today.month - 1, today.day - (days - 1)));
  const last = new Date(Date.UTC(today.year, today.month - 1, today.day + 1)); // the range is closed-open
  const at = (d: Date): CivilDate => ({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });

  const rows: { user_id: string; day: string; steps: number; synced_at: string }[] = [];
  let pageToken: string | undefined;
  do {
    const { ok, json } = await api(token, `${API}/dataTypes/steps/dataPoints:dailyRollUp`, {
      range: { start: civil(at(first)), end: civil(at(last)) },
      windowSizeDays: 1,
      pageSize: 90,
      pageToken,
    });
    if (!ok) return false;
    for (const p of (json?.rollupDataPoints ?? []) as { civilStartTime?: { date?: CivilDate }; steps?: { countSum?: string | number } }[]) {
      const date = p.civilStartTime?.date;
      const steps = Math.round(Number(p.steps?.countSum ?? 0));
      if (date && Number.isFinite(steps)) rows.push({ user_id: userId, day: dayKey(date), steps, synced_at: new Date().toISOString() });
    }
    pageToken = json?.nextPageToken || undefined;
  } while (pageToken);

  if (rows.length) {
    const { error } = await admin.from("step_days").upsert(rows, { onConflict: "user_id,day" });
    if (error) return false;
  }
  return true;
}

export async function hasActivity(userId: string) {
  const { data } = await createAdmin().from("google_health_connections").select("scopes").eq("user_id", userId).maybeSingle();
  return Boolean(data?.scopes.split(" ").includes(ACTIVITY_SCOPE));
}

/**
 * Imports workouts from the last `days` days (treadmill, runs, classes: whatever Google Health recorded) into activity_logs.
 * Already imported ones are left alone, as are ones the user deleted. Same return values as pullSteps.
 */
export async function pullWorkouts(userId: string, days: number) {
  const admin = createAdmin();
  const token = (await hasActivity(userId)) ? await accessToken(userId) : null;
  if (!token) return null;

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [{ data: profile }, { data: dismissed }] = await Promise.all([
    admin.from("profiles").select("weight_kg").eq("id", userId).maybeSingle(),
    admin.from("google_health_dismissed").select("google_health_id").eq("user_id", userId),
  ]);
  const skip = new Set((dismissed ?? []).map((d) => d.google_health_id));

  const rows = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 8; page++) {
    const params = new URLSearchParams({ pageSize: "25", filter: `exercise.interval.start_time >= "${since}"` });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${API}/dataTypes/exercise/dataPoints?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("google health api", res.status, JSON.stringify(json));
      return false;
    }
    for (const p of json.dataPoints ?? []) {
      const row = activityFromExercise(p.name ?? "", p.exercise, profile?.weight_kg ? Number(profile.weight_kg) : null);
      if (row && !skip.has(row.google_health_id)) rows.push({ ...row, user_id: userId });
    }
    pageToken = json.nextPageToken || undefined;
    if (!pageToken) break;
  }

  if (rows.length) {
    const { error } = await admin.from("activity_logs").upsert(rows, { onConflict: "user_id,google_health_id", ignoreDuplicates: true });
    if (error) return false;
  }
  return true;
}

/**
 * Imports sleep sessions that ended in the last `days` days (nights and naps) into sleep_sessions.
 * Sessions can be refined after the first sync (the watch finishes scoring stages), so existing ones are updated.
 * Same return values as pullSteps.
 */
export async function pullSleep(userId: string, days: number) {
  const admin = createAdmin();
  const { data: conn } = await admin.from("google_health_connections").select("scopes").eq("user_id", userId).maybeSingle();
  if (!conn?.scopes.split(" ").includes(SLEEP_SCOPE)) return null;
  const token = await accessToken(userId);
  if (!token) return null;

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 6; page++) {
    const params = new URLSearchParams({ pageSize: "25", filter: `sleep.interval.end_time >= "${since}"` });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${API}/dataTypes/sleep/dataPoints?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("google health api", res.status, JSON.stringify(json));
      return false;
    }
    for (const p of json.dataPoints ?? []) {
      const row = sleepFromPoint(p);
      if (row) rows.push({ ...row, user_id: userId, synced_at: new Date().toISOString() });
    }
    pageToken = json.nextPageToken || undefined;
    if (!pageToken) break;
  }

  if (rows.length) {
    const { error } = await admin.from("sleep_sessions").upsert(rows, { onConflict: "user_id,google_health_id" });
    if (error) return false;
  }
  return true;
}

/** The first number inside a rollup value, whatever Google names it (kcalSum, caloriesKcalSum, ...). */
const firstNumber = (v: unknown): number | null => {
  if (typeof v === "number" || typeof v === "string") return Number.isFinite(Number(v)) && v !== "" ? Number(v) : null;
  if (v && typeof v === "object") for (const x of Object.values(v)) {
    const n = firstNumber(x);
    if (n !== null) return n;
  }
  return null;
};

/**
 * Imports the energy burned in each of the last `days` local days. Google's daily active energy (movement and workouts,
 * not resting metabolism, which the calorie goal already accounts for) becomes one "daily activity" entry per day in
 * activity_logs, minus what imported workouts already cover, so burned totals everywhere (dashboard, history, coach) follow it.
 * `tzOffsetMin` is the browser's getTimezoneOffset(), used to place days and workouts in the user's day.
 */
export async function pullDailyBurn(userId: string, days: number, today: CivilDate, tzOffsetMin: number) {
  const admin = createAdmin();
  const { data: conn } = await admin.from("google_health_connections").select("scopes").eq("user_id", userId).maybeSingle();
  if (!conn?.scopes.split(" ").includes(ACTIVITY_SCOPE)) return null;
  const token = await accessToken(userId);
  if (!token) return null;

  const first = new Date(Date.UTC(today.year, today.month - 1, today.day - (days - 1)));
  const last = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  const at = (d: Date): CivilDate => ({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });

  const burned = new Map<string, number>();
  let pageToken: string | undefined;
  do {
    const { ok, json } = await api(token, `${API}/dataTypes/active-energy-burned/dataPoints:dailyRollUp`, {
      range: { start: civil(at(first)), end: civil(at(last)) },
      windowSizeDays: 1,
      pageSize: 14,
      pageToken,
    });
    if (!ok) return false;
    for (const p of (json?.rollupDataPoints ?? []) as { civilStartTime?: { date?: CivilDate }; activeEnergyBurned?: unknown }[]) {
      const date = p.civilStartTime?.date;
      const kcal = firstNumber(p.activeEnergyBurned);
      if (date && kcal !== null) burned.set(dayKey(date), Math.round(kcal));
    }
    pageToken = json?.nextPageToken || undefined;
  } while (pageToken);

  // Workouts already imported carry their own calories: only the rest of the day's burn goes in the daily entry
  const localDay = (iso: string) => new Date(Date.parse(iso) - tzOffsetMin * 60_000).toISOString().slice(0, 10);
  const { data: workouts } = await admin
    .from("activity_logs")
    .select("performed_at, calories_burned, google_health_id")
    .eq("user_id", userId)
    .not("google_health_id", "is", null)
    .not("google_health_id", "like", "daily-active-%")
    .gte("performed_at", new Date(first.getTime() - 86_400_000).toISOString());
  const covered = new Map<string, number>();
  for (const w of workouts ?? []) covered.set(localDay(w.performed_at), (covered.get(localDay(w.performed_at)) ?? 0) + Number(w.calories_burned));

  const { data: dismissed } = await admin.from("google_health_dismissed").select("google_health_id").eq("user_id", userId).like("google_health_id", "daily-active-%");
  const skip = new Set((dismissed ?? []).map((d) => d.google_health_id));

  const rows = [];
  for (const [day, total] of burned) {
    const id = `daily-active-${day}`;
    const rest = Math.min(20000, Math.max(0, total - (covered.get(day) ?? 0)));
    if (!rest || skip.has(id)) continue;
    const [y, m, d] = day.split("-").map(Number);
    rows.push({
      user_id: userId,
      google_health_id: id,
      // Midday on that local day, so it lands on the right day in any timezone
      performed_at: new Date(Date.UTC(y, m - 1, d, 12) + tzOffsetMin * 60_000).toISOString(),
      activity: "other",
      intensity: "light",
      duration_min: 1,
      calories_burned: rest,
      distance_km: null,
      steps: null,
      notes: "Google Health: daily activity",
    });
  }
  if (rows.length) {
    // Today's total keeps growing, so existing entries are updated
    const { error } = await admin.from("activity_logs").upsert(rows, { onConflict: "user_id,google_health_id" });
    if (error) return false;
  }
  return true;
}
