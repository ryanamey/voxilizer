import type { Metadata } from "next";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { ALL_NAV } from "@/components/dashboard/nav";

export const metadata: Metadata = { title: "Voice Profile" };

export default function Page() {
  return (
    <ComingSoon
      item={ALL_NAV.find((n) => n.href === "/dashboard/voice-profile")!}
      plan={[
        "Record five relaxed vowels once (about 30 seconds)",
        "Melody playback uses your own vowel colours and timbre",
        "Logs your comfortable range for load warnings",
      ]}
    />
  );
}
