import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAuth } from "@/lib/auth/server";

/**
 * Data Access Layer for the signed-in user. Every server-side read of the session
 * goes through here so authorization lives in one place.
 */
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

/** Returns the signed-in user, or null. Deduplicated per request. */
export const getOptionalUser = cache(async (): Promise<CurrentUser | null> => {
  // Mark this as request-time work before touching config, so prerendering never runs it.
  await connection();
  const { data } = await getAuth().getSession();
  const user = data?.user;
  if (!user) return null;
  return { id: user.id, name: user.name ?? "", email: user.email, image: user.image ?? null };
});

/** Returns the signed-in user or redirects to sign-in. Use in protected pages and actions. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getOptionalUser();
  if (!user) redirect("/sign-in");
  return user;
}
