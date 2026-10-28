import type { Metadata } from "next";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { ALL_NAV } from "@/components/dashboard/nav";

export const metadata: Metadata = { title: "Lessons" };

export default function Page() {
  return (
    <ComingSoon
      item={ALL_NAV.find((n) => n.href === "/dashboard/lessons")!}
      plan={[
        "Foundations: breath, false-fold release, clean onsets",
        "Guided effect lessons with the 7-step loop, stage by stage",
        "Unlock each stage only after its health gate passes",
      ]}
    />
  );
}
