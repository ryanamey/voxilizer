import { z } from "zod";

/** Trim and lower-case first, then validate, so pasted addresses with spaces still work. */
const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

/** Shared by the browser forms (instant feedback) and the server actions (the real check). */
export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80, "Use 80 characters or fewer."),
  email,
  password: z.string().min(8, "Use at least 8 characters.").max(128, "Use 128 characters or fewer."),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

/** Result returned by auth server actions on failure (success redirects). */
export type AuthActionResult = { error: string } | undefined;
