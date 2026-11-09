"use client";

import { keepPreviousData, useIsFetching, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { localDay } from "./day";
import type { Dish, Hit } from "./meal-search";
import type { SleepRow } from "./sleep";
import { createClient } from "./supabase/client";
import type { ChatMessage, ChatThread, Meal, Profile, SummaryRow, WeightLog } from "./types";

type Updater<T> = (rows: T[]) => T[];

/**
 * Offline, a query with nothing saved just waits (fetchStatus "paused") and stays pending.
 * That isn't loading: nothing is coming until the connection is back, so the page should say so.
 */
const waiting = (q: { isPending: boolean; fetchStatus: string }) => q.isPending && q.fetchStatus === "paused";
const loadingOf = (q: { isPending: boolean; fetchStatus: string }) => q.isPending && !waiting(q);

/** Query keys, grouped so a prefix invalidates every range/limit of the same data. */
export const keys = {
  user: ["user"] as const,
  profile: ["profile"] as const,
  meals: (start: string, end: string) => ["meals", start, end] as const,
  log: (table: string, start: string, end: string) => ["log", table, start, end] as const,
  weights: (limit: number) => ["weights", limit] as const,
  summary: (start: string, end: string, bucket: string) => ["summary", start, end, bucket] as const,
  recentDishes: ["recent-dishes"] as const,
  chatThreads: ["chat-threads"] as const,
  chat: (threadId: string) => ["chat", threadId] as const,
  reminders: ["reminders"] as const,
  startWeight: ["start-weight"] as const,
  firstLog: ["first-log"] as const,
  mealSearch: (q: string, similar: boolean) => ["meal-search", q, similar] as const,
  dishHistory: (key: string) => ["dish-history", key] as const,
  steps: (day: string) => ["steps", day] as const,
  stepSync: ["steps-sync"] as const,
  sleepRange: (start: string, end: string) => ["sleep", "range", start, end] as const,
};

/** Call after any change to meals, activity or weight so history totals refetch. */
export const invalidateSummary = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ["summary"] });
/** Call after meals are added or removed so the name suggestions stay current. */
export const invalidateRecentDishes = (qc: QueryClient) => {
  // Meal search is built from the same meals, so it needs refreshing too
  void qc.invalidateQueries({ queryKey: ["meal-search"] });
  void qc.invalidateQueries({ queryKey: ["dish-history"] });
  return qc.invalidateQueries({ queryKey: keys.recentDishes });
};

export function useUser() {
  const { data } = useQuery({
    queryKey: keys.user,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await createClient().auth.getUser();
      // A network failure isn't "signed out": throw so the saved value stays instead of becoming null
      if (error && !data.user && error.name !== "AuthSessionMissingError") throw error;
      return { userId: data.user?.id ?? null, email: data.user?.email ?? null };
    },
  });
  return { userId: data?.userId ?? null, email: data?.email ?? null };
}

export function useProfile() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: keys.profile,
    queryFn: async () => {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError && !auth.user && authError.name !== "AuthSessionMissingError") throw authError; // offline, not signed out
      if (!auth.user) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
      if (error) throw error;
      if (data) return data as Profile;
      // Fallback if the signup trigger was added after this user registered.
      const { data: created } = await supabase
        .from("profiles")
        .insert({ id: auth.user.id, display_name: auth.user.email?.split("@")[0] })
        .select()
        .single();
      return (created as Profile) ?? null;
    },
  });
  const { data, refetch } = query;
  const reload = useCallback(async () => void (await refetch()), [refetch]);
  const setProfile = useCallback((p: Profile | null) => qc.setQueryData(keys.profile, p), [qc]);
  return { profile: data ?? null, loading: loadingOf(query), unavailable: waiting(query), reload, setProfile };
}

/** Meals between two ISO timestamps, newest first. */
export function useMeals(start: string, end: string) {
  const qc = useQueryClient();
  const key = keys.meals(start, end);
  const query = useQuery({
    queryKey: key,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("meals")
        .select("*")
        .gte("eaten_at", start)
        .lt("eaten_at", end)
        .order("eaten_at", { ascending: false });
      if (error) throw error;
      return data as Meal[];
    },
  });
  const { data, error, refetch } = query;
  const reload = useCallback(async () => void (await refetch()), [refetch]);
  const setMeals = useCallback(
    (fn: Updater<Meal>) => {
      qc.setQueryData<Meal[]>(key, (old) => fn(old ?? []));
      void invalidateSummary(qc);
      void invalidateRecentDishes(qc);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key is derived from start/end
    [qc, start, end],
  );
  return { meals: data ?? [], loading: loadingOf(query), unavailable: waiting(query), error: error?.message ?? null, reload, setMeals };
}

/** Signed URLs for private meal photos, keyed by storage path. Cached per path set for the URL lifetime. */
export function useSignedUrls(paths: (string | null)[]) {
  const key = paths.filter(Boolean).sort().join("|");
  const { data } = useQuery({
    queryKey: ["signed-urls", key],
    enabled: key !== "",
    staleTime: 30 * 60_000, // URLs are valid for 60 minutes
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await createClient().storage.from("meal-images").createSignedUrls(key.split("|"), 60 * 60);
      const map: Record<string, string> = {};
      for (const d of data ?? []) if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
      return map;
    },
  });
  return data ?? {};
}

/** Rows of a log table whose timestamp column falls in [start, end), newest first. */
export function useLogRange<T>(table: "activity_logs" | "water_logs", column: string, start: string, end: string) {
  const qc = useQueryClient();
  const queryKey = keys.log(table, start, end);
  const query = useQuery({
    queryKey,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await createClient().from(table).select("*").gte(column, start).lt(column, end).order(column, { ascending: false });
      return (data as T[]) ?? [];
    },
  });
  const { data, refetch } = query;
  const reload = useCallback(async () => void (await refetch()), [refetch]);
  const setRows = useCallback(
    (fn: Updater<T>) => {
      qc.setQueryData<T[]>(queryKey, (old) => fn(old ?? []));
      void invalidateSummary(qc);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key is derived from table/start/end
    [qc, table, start, end],
  );
  return { rows: data ?? [], loading: loadingOf(query), reload, setRows };
}

/** Most recent weight entries (newest first). */
export const weightsQuery = (limit: number) => ({
  queryKey: keys.weights(limit),
  queryFn: async () => {
    const { data } = await createClient().from("weight_logs").select("*").order("logged_on", { ascending: false }).limit(limit);
    return (data as WeightLog[]) ?? [];
  },
});

/** The very first weigh-in, so progress toward a goal is measured from where you began. */
export function useStartWeight() {
  const { data } = useQuery({
    queryKey: keys.startWeight,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await createClient().from("weight_logs").select("weight_kg").order("logged_on", { ascending: true }).limit(1).maybeSingle();
      return data ? Number(data.weight_kg) : null;
    },
  });
  return data ?? null;
}

export function useWeights(limit = 30) {
  const query = useQuery(weightsQuery(limit));
  const { data, refetch } = query;
  const reload = useCallback(async () => void (await refetch()), [refetch]);
  return { weights: data ?? [], loading: loadingOf(query), reload };
}

/** Server-side totals per day/week/month in the user's timezone (handles multi-year ranges). */
export const summaryQuery = (start: string, end: string, bucket: "day" | "week" | "month") => ({
  queryKey: keys.summary(start, end, bucket),
  queryFn: async () => {
    const { data, error } = await createClient().rpc("history_summary", {
      p_start: start,
      p_end: end,
      p_bucket: bucket,
      p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (error) throw error;
    return ((data as SummaryRow[]) ?? []).map((r) => ({ ...r, ...numeric(r) }));
  },
});

export function useSummary(start: string, end: string, bucket: "day" | "week" | "month") {
  const query = useQuery({ ...summaryQuery(start, end, bucket), placeholderData: keepPreviousData });
  return { rows: query.data ?? [], loading: loadingOf(query), unavailable: waiting(query), error: query.error?.message ?? null };
}

/** Postgres numerics arrive as strings; convert the summary columns to numbers. */
function numeric(r: SummaryRow) {
  const out: Partial<SummaryRow> = {};
  for (const [k, v] of Object.entries(r)) {
    if (k !== "bucket") (out as Record<string, unknown>)[k] = v === null ? null : Number(v);
  }
  return out;
}

const RECENT_DISHES = 20;

/** Names of the most recently logged dishes, newest first, one per name. */
export const recentDishesQuery = {
  queryKey: keys.recentDishes,
  staleTime: 5 * 60_000,
  queryFn: async () => {
    const { data } = await createClient().from("meals").select("name").order("eaten_at", { ascending: false }).limit(120);
    const seen = new Set<string>();
    const names: string[] = [];
    for (const { name } of (data as { name: string }[]) ?? []) {
      const key = name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      names.push(name.trim());
      if (names.length === RECENT_DISHES) break;
    }
    return names;
  },
};

export function useRecentDishes() {
  const query = useQuery(recentDishesQuery);
  return { dishes: query.data ?? [], loading: loadingOf(query) };
}

/** Coach conversations, most recently active first. */
export const chatThreadsQuery = {
  queryKey: keys.chatThreads,
  queryFn: async () => {
    const { data } = await createClient().from("chat_threads").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(50);
    return (data as ChatThread[]) ?? [];
  },
};

export function useChatThreads() {
  const query = useQuery(chatThreadsQuery);
  return { threads: query.data, loading: loadingOf(query) };
}

/** Messages of one conversation, oldest first. Pass null for a conversation that doesn't exist yet. */
export const chatMessagesQuery = (threadId: string) => ({
  queryKey: keys.chat(threadId),
  queryFn: async () => {
    const { data } = await createClient()
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(100);
    return ((data as ChatMessage[]) ?? []).reverse();
  },
});

export function useChatMessages(threadId: string | null) {
  // threadId is only used when it isn't null (the query is off otherwise)
  const query = useQuery({ ...chatMessagesQuery(threadId ?? "new"), enabled: threadId !== null });
  return { messages: query.data, loading: threadId !== null && loadingOf(query), unavailable: threadId !== null && waiting(query) };
}

/** The earliest day anything was logged (a meal, activity, water or weight), or null if nothing was. History's "All" starts here. */
export const firstLogQuery = {
  queryKey: keys.firstLog,
  staleTime: 10 * 60_000,
  queryFn: async () => {
    const db = createClient();
    const first = <T extends string>(table: string, column: T) => db.from(table).select(column).order(column, { ascending: true }).limit(1);
    const [meals, activity, water, weight] = await Promise.all([
      first("meals", "eaten_at"),
      first("activity_logs", "performed_at"),
      first("water_logs", "logged_at"),
      first("weight_logs", "logged_on"),
    ]);
    const days: string[] = [];
    // Timestamps become the day they fall on in this person's timezone; weight is already a plain date
    for (const [res, column, isTimestamp] of [
      [meals, "eaten_at", true],
      [activity, "performed_at", true],
      [water, "logged_at", true],
      [weight, "logged_on", false],
    ] as const) {
      const value = (res.data as unknown as Record<string, string>[] | null)?.[0]?.[column];
      if (value) days.push(isTimestamp ? localDay(new Date(value)) : value);
    }
    return days.sort()[0] ?? null;
  },
};

export function useFirstLogDay() {
  const query = useQuery(firstLogQuery);
  return { first: query.data ?? null, loading: loadingOf(query) };
}

export type MealSearchResult =
  | { mode: "overview"; top: Dish[]; recent: Dish[]; total: { dishes: number; meals: number } }
  | { mode: "search"; q: string; hits: Hit[]; semantic: "on" | "off" | "learning"; total: { dishes: number; meals: number } };

/**
 * Search what you've eaten by name. An empty query gives the overview (most eaten, most recent).
 * `similar: false` skips the meaning-based matching (an AI call): for a name you tapped, which is already exact.
 */
export function useMealSearch(q: string, { enabled = true, similar = true }: { enabled?: boolean; similar?: boolean } = {}) {
  const query = useQuery({
    queryKey: keys.mealSearch(q, similar),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/search/meals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q, similar }), signal });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Search failed");
      return json as MealSearchResult;
    },
  });
  return { data: query.data, loading: loadingOf(query), fetching: query.isFetching, error: query.error?.message ?? null, unavailable: waiting(query) };
}

/** One item found inside a meal (what the AI listed): the dosa, the chutney. */
export type MealItem = { name: string; portion: string; grams: number; calories: number };
export type DishTime = { id: string; meal_type: string; calories: number; servings: number; eaten_at: string; items: MealItem[] };

/** The latest times you ate one dish (loads when `enabled`, i.e. when its card is opened). */
export function useDishHistory(key: string, enabled: boolean) {
  const query = useQuery({
    queryKey: keys.dishHistory(key),
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("meal_dish_history", { p_key: key, p_limit: 6 });
      if (error) throw error;
      return ((data as (Omit<DishTime, "items"> & { items: unknown })[]) ?? []).map((r) => ({
        ...r,
        calories: Number(r.calories),
        servings: Number(r.servings),
        // Older or unusual rows may not have a clean list: keep what looks like an item
        items: (Array.isArray(r.items) ? (r.items as Record<string, unknown>[]) : [])
          .filter((i) => i && typeof i.name === "string" && i.name.trim())
          .map((i) => ({ name: String(i.name), portion: String(i.portion ?? ""), grams: Number(i.grams) || 0, calories: Number(i.calories) || 0 })),
      }));
    },
  });
  return { times: query.data ?? [], loading: loadingOf(query) };
}

/** Steps for one local day (YYYY-MM-DD) as imported from Google Health, or null when there are none. */
export function useSteps(day: string) {
  const { data } = useQuery({
    queryKey: keys.steps(day),
    queryFn: async () => {
      const { data } = await createClient().from("step_days").select("steps").eq("day", day).maybeSingle();
      return data?.steps ?? null;
    },
  });
  return data ?? null;
}

/**
 * Pulls recent steps, workouts, burned energy and sleep from Google Health, at most every ten minutes. Does nothing unless the user connected
 * Google Health with the activity permission. Refreshes the step counts when new numbers arrive.
 */
type GoogleStatus = { configured: boolean; connected: boolean; steps?: boolean; sleep?: boolean; units?: boolean };

/** Which Google Health permissions are granted (also known from the last visit, so layouts don't jump). */
export function useGoogleStatus() {
  const { data } = useQuery({
    queryKey: ["google-health-status"],
    queryFn: async (): Promise<GoogleStatus | null> => {
      const r = await fetch("/api/google-health");
      return r.ok ? r.json() : null;
    },
    staleTime: 10 * 60_000,
  });
  return data ?? null;
}

export const useStepsEnabled = () => Boolean(useGoogleStatus()?.steps);
export const useSleepEnabled = () => Boolean(useGoogleStatus()?.sleep);

export type SleepSession = SleepRow;

/** Sleep sessions that ended on days between two local dates (YYYY-MM-DD, both included), oldest first. */
export function useSleepRange(start: string, end: string, enabled = true) {
  const query = useQuery({
    queryKey: keys.sleepRange(start, end),
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await createClient().from("sleep_sessions").select("*").gte("day", start).lte("day", end).order("started_at", { ascending: true });
      return (data as SleepRow[]) ?? [];
    },
  });
  // "loading" is only for a query that is really fetching: a disabled one has nothing to wait for
  return { rows: query.data ?? EMPTY_SLEEP, loading: enabled && loadingOf(query) };
}
const EMPTY_SLEEP: SleepRow[] = [];

/** True while the Google Health sync is running, so screens that are still empty can show a loader instead of an empty state. */
export const useGoogleSyncing = () => useIsFetching({ queryKey: keys.stepSync }) > 0;

export function useStepSync() {
  const qc = useQueryClient();
  const status = useGoogleStatus();
  const enabled = Boolean(status?.steps || status?.sleep);
  const sync = useQuery({
    queryKey: keys.stepSync,
    enabled,
    staleTime: 10 * 60_000,
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const now = new Date();
      const res = await fetch("/api/google-health/steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), days: 14, tzOffsetMin: now.getTimezoneOffset() }),
      });
      if (!res.ok) throw new Error("steps sync failed");
      // Parts that worked are saved even when another failed
      const { problems = {} } = (await res.json().catch(() => ({}))) as { problems?: Record<string, string> };
      await Promise.all([qc.invalidateQueries({ queryKey: ["steps"] }), qc.invalidateQueries({ queryKey: ["sleep"] }), qc.invalidateQueries({ queryKey: ["log", "activity_logs"] }), invalidateSummary(qc)]);
      return { at: Date.now(), problems };
    },
  });
  return { steps: Boolean(status?.steps), problems: sync.data?.problems ?? {}, syncing: sync.isFetching };
}
