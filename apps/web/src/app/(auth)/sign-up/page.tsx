import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "../auth-forms";
import { RedirectIfSignedIn } from "../redirect-if-signed-in";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <SignUpForm />
    </>
  );
}
