import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

/**
 * First line of defence: unauthenticated requests to the app are redirected to
 * sign-in before any page renders, and expiring sessions are refreshed.
 * Pages still verify the session on the server (see `lib/dal.ts`); the proxy
 * alone is never relied on for authorization.
 */
export default function proxy(request: NextRequest) {
  return getAuth().middleware({ loginUrl: "/sign-in" })(request);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
