"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useProfile } from "@/lib/hooks";
import { useOnline } from "@/lib/offline";
import { isProfileComplete } from "@/lib/profile";
import { PageSkeleton } from "./ClientOnly";

/**
 * The app needs a profile (body details, goals) to be useful, so nobody gets past this until it's filled in.
 * The profile is usually already cached, so for a returning user this adds no wait.
 * If the profile can't be read at all (offline with nothing saved), let them through rather than lock them out.
 */
export default function ProfileGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const online = useOnline();
  const { profile, loading } = useProfile();
  const needsSetup = profile !== null && !isProfileComplete(profile);

  useEffect(() => {
    if (needsSetup && online) router.replace("/onboarding");
  }, [needsSetup, online, router]);

  if (loading || (needsSetup && online)) return <PageSkeleton />;
  return children;
}
