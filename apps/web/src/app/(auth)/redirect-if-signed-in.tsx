import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/dal";

/** Sends a signed-in visitor straight to the dashboard. Render inside a Suspense boundary. */
export async function RedirectIfSignedIn() {
  const user = await getOptionalUser().catch(() => null);
  if (user) redirect("/dashboard");
  return null;
}
