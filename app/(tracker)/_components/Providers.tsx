"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { loadSavedQueries, MAX_AGE_MS, saveQueriesOnChange } from "@/lib/offline";

/**
 * One cache per browser tab: revisiting a page or date shows cached data instantly, then revalidates.
 * The cache is also saved on the device, so the last fetched data can still be read without a connection.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    const qc = new QueryClient({
      // gcTime must be at least as long as the saved data's lifetime, or unused entries are dropped from the saved copy too
      defaultOptions: { queries: { staleTime: 60_000, gcTime: MAX_AGE_MS, refetchOnWindowFocus: false, retry: 1 } },
    });
    // Load the saved copy before the first render so pages open with data instead of skeletons
    if (typeof window !== "undefined") loadSavedQueries(qc);
    return qc;
  });
  useEffect(() => saveQueriesOnChange(client), [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
