"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { localDay } from "@/lib/day";
import { chatMessagesQuery, chatThreadsQuery, keys, recentDishesQuery, summaryQuery } from "@/lib/hooks";
import { useOnline } from "@/lib/offline";
import type { ChatThread } from "@/lib/types";

const TABS = ["/dashboard", "/history", "/scan", "/coach", "/profile"];
/** The History page opens on this many days (its "30d" tab). Keep it in step with HistoryView. */
const HISTORY_DAYS = 30;
const START_AFTER_MS = 2000;

/**
 * Gets the other tabs ready while you're looking at this one, so opening them is instant:
 * their code, and the data they show first (History's default range, the name suggestions for Log meal,
 * the coach's conversation list and your latest chat). Uses the same queries and cache keys as the pages,
 * so a page that already has fresh data doesn't ask again. Quiet on a slow connection or with Data Saver on.
 */
export default function TabPrefetch() {
  const qc = useQueryClient();
  const router = useRouter();
  const online = useOnline();

  useEffect(() => {
    if (!online) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "")) return;

    let cancelled = false;
    // Wait a moment so what's on screen loads first, then go one request at a time rather than all at once
    const timer = setTimeout(async () => {
      for (const href of TABS) router.prefetch(href);

      const today = new Date();
      const first = new Date(today);
      first.setDate(today.getDate() - (HISTORY_DAYS - 1));
      const steps: (() => Promise<unknown>)[] = [
        () => qc.prefetchQuery(summaryQuery(localDay(first), localDay(today), "day")),
        () => qc.prefetchQuery(recentDishesQuery),
        async () => {
          await qc.prefetchQuery(chatThreadsQuery);
          const latest = qc.getQueryData<ChatThread[]>(keys.chatThreads)?.[0];
          if (latest) await qc.prefetchQuery(chatMessagesQuery(latest.id));
        },
      ];
      for (const step of steps) {
        if (cancelled) return;
        await step().catch(() => {}); // a failed warm-up just means the page asks for it itself
      }
    }, START_AFTER_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [online, qc, router]);

  return null;
}
