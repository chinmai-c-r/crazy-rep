"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { keys } from "@/lib/hooks";
import { profileSchema, type ProfileInput, type ProfileValues } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export type SaveStatus = "idle" | "saving" | "saved" | "invalid" | "error";

/** Typing waits for a pause; a tap on a toggle or a select saves almost at once. */
const TYPING_MS = 900;
const TAP_MS = 250;
const TYPED_FIELDS = new Set<string>(["display_name", "age", "height_cm", "weight_kg", "target_weight_kg", "calorie_goal", "protein_goal_g", "carbs_goal_g", "fat_goal_g", "water_goal_ml"]);

/**
 * Saves the profile form as it changes, so there is no Save button.
 * - Waits for a pause in typing (debounce), and saves only valid values that differ from what's already saved.
 * - One request at a time: edits made while saving are sent right after, so the last edit always wins.
 * - Saves immediately when leaving the page or sending the app to the background, so nothing typed is lost.
 */
export function useAutosaveProfile(form: UseFormReturn<ProfileInput, unknown, ProfileValues>, profile: Profile) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inFlight = useRef(false);
  const again = useRef(false);
  /** What the server has now, in the same shape the form produces, so unchanged forms don't send anything. */
  const saved = useRef<string>("");
  const failed = useRef(false);
  const saveRef = useRef<() => void>(() => {});
  const id = profile.id;
  const hasDiet = "diet" in profile;
  const hasWeightGoal = "target_weight_kg" in profile;

  useEffect(() => {
    const initial = profileSchema.safeParse(form.getValues());
    saved.current = initial.success ? JSON.stringify(initial.data) : "";

    async function save() {
      if (inFlight.current) {
        again.current = true; // sent as soon as the current request finishes
        return;
      }
      const parsed = profileSchema.safeParse(form.getValues());
      if (!parsed.success) return setStatus("invalid");
      const snapshot = JSON.stringify(parsed.data);
      if (snapshot === saved.current) return setStatus((s) => (s === "invalid" ? "saved" : s));

      inFlight.current = true;
      setStatus("saving");
      // A profile read before the diet migration ran has no diet column yet; leave it out so saving still works
      const { diet, target_weight_kg, weekly_rate_kg, ...rest } = parsed.data;
      const { data, error } = await createClient()
        .from("profiles")
        .update({ ...rest, ...(hasDiet ? { diet } : {}),
          ...(hasWeightGoal ? { target_weight_kg, weekly_rate_kg } : {}), display_name: parsed.data.display_name || null })
        .eq("id", id)
        .select()
        .single();
      inFlight.current = false;
      failed.current = Boolean(error);

      if (error) {
        setStatus("error");
        toast.error(`Couldn't save: ${error.message}`);
      } else {
        saved.current = snapshot;
        qc.setQueryData(keys.profile, data); // keeps other pages (and the offline copy) current
        setStatus("saved");
      }
      if (again.current) {
        again.current = false;
        void save();
      }
    }

    saveRef.current = () => void save();
    const schedule = (ms: number) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = undefined;
        void save();
      }, ms);
    };
    const flush = () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      timer.current = undefined;
      void save();
    };

    const sub = form.watch((_values, { name }) => {
      if (!name) return; // a reset, not an edit
      setStatus((s) => (s === "saved" || s === "error" ? "idle" : s));
      schedule(TYPED_FIELDS.has(name) ? TYPING_MS : TAP_MS);
    });
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    // A save that failed for lack of a connection is retried when it returns
    const onOnline = () => failed.current && void save();
    window.addEventListener("online", onOnline);

    return () => {
      sub.unsubscribe();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("online", onOnline);
      flush(); // leaving the page: don't drop a pending edit
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once per form
  }, [form, id]);

  /** Try again after a failed save. */
  const retry = () => saveRef.current();

  return { status, retry };
}
