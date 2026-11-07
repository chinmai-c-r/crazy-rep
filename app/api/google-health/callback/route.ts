import { NextResponse, type NextRequest } from "next/server";
import { ACTIVITY_SCOPE, exchangeCode, SCOPE } from "@/lib/google-health";
import { createAdmin, createClient } from "@/lib/supabase/server";

/** Google sends the user back here after they approve (or refuse) access. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const done = (result: string) => {
    const response = NextResponse.redirect(`${origin}/profile?google_health=${result}`);
    response.cookies.delete({ name: "gh_oauth_state", path: "/api/google-health" });
    return response;
  };

  const { data } = await (await createClient()).auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.redirect(`${origin}/login?next=/profile`);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (searchParams.get("error") || !code) return done("denied");
  if (!state || state !== request.cookies.get("gh_oauth_state")?.value) return done("error");

  const tokens = await exchangeCode(origin, code);
  if (!tokens?.refresh_token) return done("error");
  // Users can untick scopes on the consent screen; without this one there is nothing to sync
  const granted = tokens.scope?.split(" ") ?? [];
  if (!granted.includes(SCOPE)) return done("denied");
  // Steps are optional: keep only what was actually granted so the app knows what it may read
  const scopes = [SCOPE, ACTIVITY_SCOPE].filter((s) => granted.includes(s)).join(" ");

  const { error } = await createAdmin()
    .from("google_health_connections")
    .upsert({ user_id: userId, refresh_token: tokens.refresh_token, scopes });
  return done(error ? "error" : "connected");
}
