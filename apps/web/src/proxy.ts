import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

/**
 * First line of defence: unauthenticated requests to the app are redirected to
 * sign-in before any page renders, and expiring sessions are refreshed.
 * Pages still verify the session on the server (see `lib/dal.ts`); the proxy
 * alone is never relied on for authorization.
 *
 * It fails closed: if auth can't run (missing environment variables, Neon Auth
 * unreachable), the visitor is sent to sign-in instead of seeing an error page.
 */
export default async function proxy(request: NextRequest) {
  try {
    return await getAuth().middleware({ loginUrl: "/sign-in" })(request);
  } catch (err) {
    console.error("[auth] proxy could not check the session:", err);
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
