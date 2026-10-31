import { NextResponse, type NextRequest } from "next/server";
import { authUrl, isConfigured } from "@/lib/google-health";
import { createClient } from "@/lib/supabase/server";

/** Starts the Google OAuth flow for the signed-in user. */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const { data } = await (await createClient()).auth.getClaims();
  if (!data?.claims) return NextResponse.redirect(`${origin}/login?next=/profile`);
  if (!isConfigured()) return NextResponse.redirect(`${origin}/profile?google_health=unavailable`);

  const state = crypto.randomUUID();
  const response = NextResponse.redirect(authUrl(origin, state));
  response.cookies.set("gh_oauth_state", state, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", path: "/api/google-health", maxAge: 600 });
  return response;
}
