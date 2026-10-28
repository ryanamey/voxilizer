"use server";

import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/server";
import { signInSchema, signUpSchema, type AuthActionResult } from "@/lib/validation/auth";

const GENERIC_ERROR = "Something went wrong. Please try again in a moment.";

/** Only allow redirects to our own app paths, never to another site. */
function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/dashboard") ? next : "/dashboard";
}

export async function signInAction(input: unknown, next?: string): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  let failed: string | null = null;
  try {
    const { error } = await getAuth().signIn.email(parsed.data);
    // Deliberately vague: never reveal whether an email has an account.
    if (error) failed = "That email and password don't match. Check them and try again.";
  } catch {
    failed = GENERIC_ERROR;
  }
  if (failed) return { error: failed };
  redirect(safeNext(next));
}

export async function signUpAction(input: unknown): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  let failed: string | null = null;
  try {
    const { error } = await getAuth().signUp.email(parsed.data);
    if (error) {
      failed =
        error.status === 422 || /exist/i.test(error.message ?? "")
          ? "An account with this email already exists. Sign in instead."
          : (error.message ?? GENERIC_ERROR);
    }
  } catch {
    failed = GENERIC_ERROR;
  }
  if (failed) return { error: failed };
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  try {
    await getAuth().signOut();
  } finally {
    redirect("/");
  }
}
