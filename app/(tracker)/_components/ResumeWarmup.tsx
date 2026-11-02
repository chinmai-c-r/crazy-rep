"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const AWAY_MS = 30_000; // shorter than this the server is still warm
const THROTTLE_MS = 60_000;

/**
 * An installed app resumed from memory has cold server instances and (after an hour) an expired access token,
 * and the first tap pays for both. When the app comes back to the foreground, start both now.
 */
export default function ResumeWarmup() {
  useEffect(() => {
    let hiddenAt = 0;
    let lastWarm = 0;

    const onChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const now = Date.now();
      if (!hiddenAt || now - hiddenAt < AWAY_MS || now - lastWarm < THROTTLE_MS) return;
      lastWarm = now;
      void fetch("/api/ping", { cache: "no-store" }).catch(() => {});
      void createClient().auth.getSession(); // refreshes an expired token before the first query needs it
    };

    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return null;
}
