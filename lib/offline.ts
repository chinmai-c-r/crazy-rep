"use client";

import { dehydrate, hydrate, onlineManager, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

// ---------- Connection state ----------

const subscribe = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

/** False while the device has no connection. Assumed online on the server and before hydration. */
export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

// ---------- Saved data ----------

const STORAGE_KEY = "crazy-rep:query-cache";
/** How long saved data stays usable. The query cache keeps entries in memory at least this long too. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
const SAVE_DELAY_MS = 1_000;
/** Matches the page cache name in public/sw.js. */
const PAGE_CACHE = "crazy-rep-pages-v2";

/** Per kind of data: how many of the most recent queries are kept (a day of meals each, so ~3 weeks). */
const KEEP: Record<string, number> = { meals: 21, log: 42, summary: 8, chat: 12, weights: 4, "meal-search": 8, "dish-history": 12, steps: 14, sleep: 14, "google-health-status": 1 };
/** Signed photo URLs expire within the hour, so they're never worth saving. */
const SAVED_KEYS = new Set(["user", "profile", "meals", "log", "weights", "summary", "recent-dishes", "chat-threads", "chat", "meal-search", "dish-history", "steps", "sleep", "google-health-status"]);

const storageOf = () => {
  try {
    return window.localStorage;
  } catch {
    return null; // storage blocked (private mode on some browsers)
  }
};

/** Put the data saved on this device into the cache. Call once, before the first render. */
export function loadSavedQueries(client: QueryClient) {
  const store = storageOf();
  if (!store) return;
  onlineManager.setOnline(navigator.onLine); // queries should pause, not fail, when the app opens offline
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { savedAt: number; state: Parameters<typeof hydrate>[1] };
    if (Date.now() - saved.savedAt < MAX_AGE_MS) hydrate(client, saved.state);
    else store.removeItem(STORAGE_KEY);
  } catch {
    store.removeItem(STORAGE_KEY); // unreadable or from an older shape
  }
}

/**
 * Save the cache on the device as it changes (throttled) so the last fetched data can be read offline.
 * Returns a function that stops saving.
 */
export function saveQueriesOnChange(client: QueryClient) {
  const store = storageOf();
  if (!store) return () => {};

  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    timer = undefined;
    const seen: Record<string, number> = {};
    const state = dehydrate(client, {
      shouldDehydrateQuery: (q) => q.state.status === "success" && SAVED_KEYS.has(String(q.queryKey[0])),
    });
    // Newest first, then trim each kind to its limit so storage doesn't grow without end
    state.queries = state.queries
      .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
      .filter((q) => {
        const kind = String(q.queryKey[0]);
        seen[kind] = (seen[kind] ?? 0) + 1;
        return seen[kind] <= (KEEP[kind] ?? Infinity);
      });
    try {
      store.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), state }));
    } catch {
      // Out of space: keep just the essentials rather than nothing
      try {
        state.queries = state.queries.filter((q) => ["user", "profile", "summary", "weights"].includes(String(q.queryKey[0]))).slice(0, 12);
        store.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), state }));
      } catch {
        store.removeItem(STORAGE_KEY);
      }
    }
  };

  const unsubscribe = client.getQueryCache().subscribe(() => {
    timer ??= setTimeout(save, SAVE_DELAY_MS);
  });
  // Don't lose the last change when the app is closed or sent to the background
  const flush = () => {
    if (!timer) return;
    clearTimeout(timer);
    save();
  };
  const onHide = () => document.visibilityState === "hidden" && flush();
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", flush);

  return () => {
    unsubscribe();
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", flush);
    if (timer) clearTimeout(timer);
  };
}

/** Forget everything saved for offline use. Call when someone signs in or out, or deletes their account. */
export function clearOfflineData(client?: QueryClient) {
  client?.clear();
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
  void window.caches?.delete(PAGE_CACHE).catch(() => {});
}
