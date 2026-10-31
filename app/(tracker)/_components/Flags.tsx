"use client";

import { createClient, type LDClient } from "@launchdarkly/js-client-sdk";
import { createContext, useContext, useEffect, useState } from "react";
import { flagContext, flagDefault, requestAccessUrl, type BoolFlag, type FlagUser } from "@/lib/flags";
import { useUser } from "@/lib/hooks";
import { createClient as createSupabase } from "@/lib/supabase/client";

const CLIENT_ID = process.env.NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID;

/** version changes on every flag update so consumers re-render. */
const FlagsContext = createContext<{ client: LDClient | null; user: FlagUser | null; version: number }>({ client: null, user: null, version: 0 });

/**
 * Connects the signed-in user to LaunchDarkly and signs them out if sign-in-users turns off
 * while they're using the app (proxy.ts blocks every new request too).
 * Without a client ID every flag uses its default.
 */
export function FlagsProvider({ children }: { children: React.ReactNode }) {
  const { userId, email } = useUser();
  const [state, setState] = useState<{ client: LDClient | null; version: number }>({ client: null, version: 0 });

  useEffect(() => {
    if (!CLIENT_ID || !userId) return;
    const user = { id: userId, email };
    const client = createClient(CLIENT_ID, flagContext(user), { streaming: true });
    const update = () => {
      if (!client.boolVariation("sign-in-users", flagDefault("sign-in-users"))) {
        void createSupabase()
          .auth.signOut()
          .then(() => window.location.replace(requestAccessUrl(email)));
      }
      setState((s) => ({ client, version: s.version + 1 }));
    };
    client.on("change", update);
    client.start().then(update);
    return () => {
      client.off("change", update);
      void client.close();
    };
  }, [userId, email]);

  return <FlagsContext value={{ ...state, user: userId ? { id: userId, email } : null }}>{children}</FlagsContext>;
}

/** Live value of a flag for the signed-in user (the default until LaunchDarkly answers). */
export function useFlag(key: BoolFlag): boolean {
  const { client, user } = useContext(FlagsContext);
  if (!user) return false; // not known yet
  const fallback = flagDefault(key);
  return client ? client.boolVariation(key, fallback) : fallback;
}
