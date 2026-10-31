"use client";

import { useSyncExternalStore } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const subscribe = () => () => {};

/**
 * Tracker pages depend on the user's timezone and session, so they render in the browser only.
 * The server ships a lightweight skeleton instead.
 */
export default function ClientOnly({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return mounted ? children : <PageSkeleton />;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4 sm:p-6 lg:p-10">
      <Skeleton className="h-12 w-48" />
      <Skeleton className="h-72 rounded-3xl" />
    </div>
  );
}
