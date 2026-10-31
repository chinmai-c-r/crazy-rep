"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { CoachSkeleton, DashboardSkeleton, GenericSkeleton, HistorySkeleton, ProfileSkeleton, ScanSkeleton } from "./Skeletons";

const subscribe = () => () => {};

/**
 * Tracker pages depend on the user's timezone and session, so they render in the browser only.
 * The server ships a skeleton shaped like the current page instead.
 */
export default function ClientOnly({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return mounted ? children : <PageSkeleton />;
}

export function PageSkeleton() {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard")) return <DashboardSkeleton />;
  if (pathname.startsWith("/history")) return <HistorySkeleton />;
  if (pathname.startsWith("/coach")) return <CoachSkeleton />;
  if (pathname.startsWith("/profile")) return <ProfileSkeleton />;
  if (pathname.startsWith("/scan")) return <ScanSkeleton />;
  return <GenericSkeleton />;
}
