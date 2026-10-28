import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema } from "../auth";

describe("auth validation", () => {
  it("normalises email and accepts a valid sign-up", () => {
    const r = signUpSchema.parse({ name: " Ali ", email: " Ali@Example.COM ", password: "longenough" });
    expect(r).toEqual({ name: "Ali", email: "ali@example.com", password: "longenough" });
  });

  it("rejects short passwords and bad emails with readable messages", () => {
    const r = signUpSchema.safeParse({ name: "A", email: "nope", password: "short" });
    expect(r.success).toBe(false);
    const messages = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(messages).toContain("Use at least 8 characters.");
    expect(messages).toContain("Enter a valid email address.");
  });

  it("requires a password to sign in", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});
