import type { Metadata } from "next";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { ALL_NAV } from "@/components/dashboard/nav";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <ComingSoon
      item={ALL_NAV.find((n) => n.href === "/dashboard/settings")!}
      plan={["Profile and password", "Theme and audio preferences", "Delete your account and data"]}
    />
  );
}
