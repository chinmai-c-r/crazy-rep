"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import type { Meal, Profile, SummaryRow, WeightLog } from "./types";

export function useUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
    });
  }, []);
  return { userId, email };
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setLoading(false);
    const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
    if (data) {
      setProfile(data as Profile);
    } else {
      // Fallback if the signup trigger was added after this user registered.
      const { data: created } = await supabase
        .from("profiles")
        .insert({ id: auth.user.id, display_name: auth.user.email?.split("@")[0] })
        .select()
        .single();
      setProfile(created as Profile);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching on mount
    reload();
  }, [reload]);

  return { profile, loading, reload, setProfile };
}

/** Meals between two ISO timestamps, newest first. */
export function useMeals(start: string, end: string) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await createClient()
      .from("meals")
      .select("*")
      .gte("eaten_at", start)
      .lt("eaten_at", end)
      .order("eaten_at", { ascending: false });
    setError(error?.message ?? null);
    setMeals((data as Meal[]) ?? []);
    setLoading(false);
  }, [start, end]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching on range change
    reload();
  }, [reload]);

  return { meals, loading, error, reload, setMeals };
}

/** Signed URLs for private meal photos, keyed by storage path. */
export function useSignedUrls(paths: (string | null)[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.filter(Boolean).sort().join("|");

  useEffect(() => {
    const list = key ? key.split("|") : [];
    if (!list.length) return;
    let cancelled = false;
    createClient()
      .storage.from("meal-images")
      .createSignedUrls(list, 60 * 60)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map: Record<string, string> = {};
        for (const d of data) if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
        setUrls(map);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return urls;
}

/** Rows of a log table whose timestamp column falls in [start, end), newest first. */
export function useLogRange<T>(table: "activity_logs" | "water_logs", column: string, start: string, end: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await createClient()
      .from(table)
      .select("*")
      .gte(column, start)
      .lt(column, end)
      .order(column, { ascending: false });
    setRows((data as T[]) ?? []);
    setLoading(false);
  }, [table, column, start, end]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching on range change
    reload();
  }, [reload]);

  return { rows, loading, reload, setRows };
}

/** Most recent weight entries (newest first). */
export function useWeights(limit = 30) {
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await createClient().from("weight_logs").select("*").order("logged_on", { ascending: false }).limit(limit);
    setWeights((data as WeightLog[]) ?? []);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching on mount
    reload();
  }, [reload]);

  return { weights, loading, reload };
}

/** Server-side totals per day/week/month in the user's timezone (handles multi-year ranges). */
export function useSummary(start: string, end: string, bucket: "day" | "week" | "month") {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching on range change
    setLoading(true);
    createClient()
      .rpc("history_summary", {
        p_start: start,
        p_end: end,
        p_bucket: bucket,
        p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        setError(error?.message ?? null);
        setRows(((data as SummaryRow[]) ?? []).map((r) => ({ ...r, ...numeric(r) })));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [start, end, bucket]);

  return { rows, loading, error };
}

/** Postgres numerics arrive as strings; convert the summary columns to numbers. */
function numeric(r: SummaryRow) {
  const out: Partial<SummaryRow> = {};
  for (const [k, v] of Object.entries(r)) {
    if (k !== "bucket") (out as Record<string, unknown>)[k] = v === null ? null : Number(v);
  }
  return out;
}
