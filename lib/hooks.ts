"use client";

import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
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
};

/** Call after any change to meals, activity or weight so history totals refetch. */
export const invalidateSummary = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ["summary"] });
/** Call after meals are added or removed so the name suggestions stay current. */
export const invalidateRecentDishes = (qc: QueryClient) => qc.invalidateQueries({ queryKey: keys.recentDishes });

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
export function useWeights(limit = 30) {
  const query = useQuery({
    queryKey: keys.weights(limit),
    queryFn: async () => {
      const { data } = await createClient().from("weight_logs").select("*").order("logged_on", { ascending: false }).limit(limit);
      return (data as WeightLog[]) ?? [];
    },
  });
  const { data, refetch } = query;
  const reload = useCallback(async () => void (await refetch()), [refetch]);
  return { weights: data ?? [], loading: loadingOf(query), reload };
}

/** Server-side totals per day/week/month in the user's timezone (handles multi-year ranges). */
export function useSummary(start: string, end: string, bucket: "day" | "week" | "month") {
  const query = useQuery({
    queryKey: keys.summary(start, end, bucket),
    placeholderData: keepPreviousData,
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
export function useRecentDishes() {
  const query = useQuery({
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
  });
  return { dishes: query.data ?? [], loading: loadingOf(query) };
}

/** Coach conversations, most recently active first. */
export function useChatThreads() {
  const query = useQuery({
    queryKey: keys.chatThreads,
    queryFn: async () => {
      const { data } = await createClient().from("chat_threads").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(50);
      return (data as ChatThread[]) ?? [];
    },
  });
  return { threads: query.data, loading: loadingOf(query) };
}

/** Messages of one conversation, oldest first. Pass null for a conversation that doesn't exist yet. */
export function useChatMessages(threadId: string | null) {
  const query = useQuery({
    queryKey: keys.chat(threadId ?? "new"),
    enabled: threadId !== null,
    queryFn: async () => {
      const { data } = await createClient()
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("thread_id", threadId!)
        .order("created_at", { ascending: false })
        .limit(100);
      return ((data as ChatMessage[]) ?? []).reverse();
    },
  });
  return { messages: query.data, loading: threadId !== null && loadingOf(query), unavailable: threadId !== null && waiting(query) };
}
