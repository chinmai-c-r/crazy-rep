import "server-only";
import { createAdmin } from "@/lib/supabase/server";
import type { Meal } from "@/lib/types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://health.googleapis.com/v4/users/me";
const NUTRITION = `${API}/dataTypes/nutrition-log/dataPoints`;

export const SCOPE = "https://www.googleapis.com/auth/googlehealth.nutrition.writeonly";

export const isConfigured = () => Boolean(process.env.GOOGLE_HEALTH_CLIENT_ID && process.env.GOOGLE_HEALTH_CLIENT_SECRET);

export const redirectUri = (origin: string) => `${origin}/api/google-health/callback`;

export function authUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_HEALTH_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPE,
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

function nutritionLog(m: MealForSync) {
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
      serving: { amount: Number(m.servings) },
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

async function removeRemote(token: string, id: string) {
  // Entries from anonymous foods can't be updated and have no single-item delete
  await api(token, `${NUTRITION}:batchDelete`, { names: [`users/me/dataTypes/nutrition-log/dataPoints/${id}`] });
}

/** Writes the meal to Google Health, replacing the previous entry if there is one. Returns the new entry id. */
export async function pushMeal(userId: string, meal: MealForSync) {
  const token = await accessToken(userId);
  if (!token) return { connected: false as const };

  if (meal.google_health_id) await removeRemote(token, meal.google_health_id);

  const { ok, json } = await api(token, NUTRITION, nutritionLog(meal));
  // The response is a long-running operation wrapper: { done, response: DataPoint }
  const name: string | undefined = json?.response?.name ?? json?.name;
  const id = name?.split("/").pop();
  return { connected: true as const, ok: ok && Boolean(id), id: id ?? null };
}

export async function deleteMeal(userId: string, googleHealthId: string) {
  const token = await accessToken(userId);
  if (!token) return false;
  await removeRemote(token, googleHealthId);
  return true;
}
