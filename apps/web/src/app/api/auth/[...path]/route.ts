import { getAuth } from "@/lib/auth/server";

/** Proxies the browser auth client's requests to Neon Auth and manages session cookies. */
type Ctx = { params: Promise<{ path: string[] }> };

export function GET(request: Request, ctx: Ctx) {
  return getAuth().handler().GET(request, ctx);
}

export function POST(request: Request, ctx: Ctx) {
  return getAuth().handler().POST(request, ctx);
}
