import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { serverEnv } from "@/lib/env";

type NeonAuth = ReturnType<typeof createNeonAuth>;

let instance: NeonAuth | null = null;

/**
 * The Neon Auth (managed Better Auth) server instance.
 *
 * Created lazily so that importing this module never requires environment
 * variables (e.g. during `next build` in CI); they are validated on first use.
 * Use only on the server: Server Components, Server Actions, Route Handlers, proxy.
 */
export function getAuth(): NeonAuth {
  if (!instance) {
    const env = serverEnv();
    instance = createNeonAuth({
      baseUrl: env.NEON_AUTH_BASE_URL,
      cookies: { secret: env.NEON_AUTH_COOKIE_SECRET },
    });
  }
  return instance;
}
