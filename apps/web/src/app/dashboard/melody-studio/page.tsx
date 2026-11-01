import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { MelodyStudioPage } from "@/components/melody-studio/melody-studio-page";

export const metadata: Metadata = { title: "Melody Studio" };

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Melody Studio"
        description="Write a vocal line with the tones from your library, hear it, and see its vocal load."
      />
      <MelodyStudioPage />
    </div>
  );
}
