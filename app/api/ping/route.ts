import { connection } from "next/server";

/**
 * Warm-up target for the installed app. It does nothing itself: the request still passes through proxy.ts
 * (Supabase auth + LaunchDarkly), so a cold server instance finishes starting up while the user is still
 * looking at the screen instead of on their first tap.
 */
export async function GET() {
  await connection(); // dynamic on purpose: a prerendered response would never reach a function
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
