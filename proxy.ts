import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/scan/:path*", "/history/:path*", "/profile/:path*", "/coach/:path*", "/api-test/:path*", "/onboarding/:path*", "/login", "/api/:path*"],
};
