import type { Metadata } from "next";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { ALL_NAV } from "@/components/dashboard/nav";

export const metadata: Metadata = { title: "Progress" };

export default function Page() {
  return (
    <ComingSoon
      item={ALL_NAV.find((n) => n.href === "/dashboard/progress")!}
      plan={[
        "Daily voice check-in: speaking voice, soft high note, pain",
        "Effect minutes per day and week, with a safe weekly increase",
        "Clean-voice baseline trend as an early warning",
      ]}
    />
  );
}
