import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { GritLab } from "@/components/grit-lab/grit-lab";

export const metadata: Metadata = { title: "Grit Lab" };

export default function GritLabPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Grit Lab"
        description="Shape a rough vocal tone, write the line, and hear it without spending your voice."
      />
      <GritLab />
    </div>
  );
}
