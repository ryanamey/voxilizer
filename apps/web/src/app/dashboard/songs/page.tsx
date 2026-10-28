import type { Metadata } from "next";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { ALL_NAV } from "@/components/dashboard/nav";

export const metadata: Metadata = { title: "Songs" };

export default function Page() {
  return (
    <ComingSoon
      item={ALL_NAV.find((n) => n.href === "/dashboard/songs")!}
      plan={[
        "List, rename and delete your saved melodies",
        "Duplicate a song to try alternative tone maps",
        "Export a tone sheet (lyrics annotated with effects) for your band or producer",
      ]}
    />
  );
}
