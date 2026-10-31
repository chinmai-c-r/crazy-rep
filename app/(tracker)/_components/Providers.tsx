"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/** One cache per browser tab: revisiting a page or date shows cached data instantly, then revalidates. */
export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false, retry: 1 } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
