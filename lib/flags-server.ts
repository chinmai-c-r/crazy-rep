import "server-only";
import { init, type LDClient } from "@launchdarkly/node-server-sdk";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { flagContext, flagDefault, type BoolFlag, type FlagUser } from "./flags";

/** One client per server instance (survives hot reloads in dev). */
const globalForLd = globalThis as { ldClient?: Promise<LDClient | null> };

function getClient(): Promise<LDClient | null> {
  const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
  if (!sdkKey) return Promise.resolve(null);
  globalForLd.ldClient ??= (async () => {
    const client = init(sdkKey);
    try {
      await client.waitForInitialization({ timeout: 5 });
    } catch (err) {
      // Flags return their defaults until the client connects
      console.warn("LaunchDarkly init failed; using flag defaults", (err as Error).message);
    }
    return client;
  })();
  return globalForLd.ldClient;
}

/** Boolean flag for a signed-in user. Works in proxy.ts and route handlers. */
export async function boolFlag(key: BoolFlag, user: FlagUser): Promise<boolean> {
  const client = await getClient();
  const fallback = flagDefault(key, user);
  if (!client) return fallback;
  const value = await client.boolVariation(key, flagContext(user), fallback);
  // Send evaluation events after the response, before a serverless function freezes
  after(() => client.flush().catch(() => {}));
  return value;
}

/**
 * sign-in-users for someone who doesn't have an account yet. There's no user ID, so the context key
 * is a hash of the email (the email itself stays private); target these people by email.
 */
export function canSignUp(email: string): Promise<boolean> {
  const id = `email-${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 32)}`;
  return boolFlag("sign-in-users", { id, email });
}
