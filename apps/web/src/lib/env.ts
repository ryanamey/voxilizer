import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once on first use. Fails fast with a readable
 * message when a variable is missing, instead of an obscure error deep in a request.
 * Variables are documented in `.env.example` and HANDBOOK.md.
 */
const serverSchema = z.object({
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: "DATABASE_URL must be a postgres:// connection string",
  }),
  NEON_AUTH_BASE_URL: z.url({ error: "NEON_AUTH_BASE_URL must be the Auth URL from the Neon Console" }),
  NEON_AUTH_COOKIE_SECRET: z
    .string()
    .min(32, "NEON_AUTH_COOKIE_SECRET must be at least 32 characters (openssl rand -base64 32)"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid or missing environment variables:\n${issues}\nSee apps/web/.env.example.`);
  }
  cached = parsed.data;
  return cached;
}
