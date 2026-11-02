import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { NO_ACCESS_MESSAGE, requestAccessUrl } from "../flags";
import { boolFlag } from "../flags-server";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

const PROTECTED = ["/dashboard", "/scan", "/history", "/profile", "/coach", "/api-test", "/onboarding"];

/** Refreshes the auth cookie on every request, gates the tracker routes and applies the sign-in-users flag. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const t0 = Date.now();
  const { data } = await supabase.auth.getClaims();
  const authMs = Date.now() - t0;
  const claims = data?.claims;
  const signedIn = Boolean(claims);
  const { pathname } = request.nextUrl;

  // Signed in but not allowed by LaunchDarkly: end the session and send them to request access
  const t1 = Date.now();
  const allowed = claims ? await boolFlag("sign-in-users", { id: claims.sub, email: claims.email }) : true;
  const flagMs = Date.now() - t1;
  // Where a slow navigation went (visible in the server logs); quiet when everything is fast
  if (authMs + flagMs > 800) console.warn(`proxy slow ${pathname}: auth ${authMs}ms, flag ${flagMs}ms`);

  if (claims && !allowed) {
    await supabase.auth.signOut({ scope: "local" });
    if (pathname.startsWith("/api/")) return withCookies(NextResponse.json({ error: NO_ACCESS_MESSAGE }, { status: 403 }), response);
    return withCookies(NextResponse.redirect(new URL(requestAccessUrl(claims.email), request.url)), response);
  }

  if (!signedIn && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (signedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

/** Copies auth cookie changes (such as a sign-out) onto a new response. */
function withCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}
