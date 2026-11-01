import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { VocalTuner } from "@/components/vocal-tuner/vocal-tuner";

export const metadata: Metadata = { title: "Vocal Tuner" };

export default function VocalTunerPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vocal Tuner"
        description="Pick a note on the piano and sing it. You'll see where you land in real time, and which way to go."
      />
      <VocalTuner />
    </div>
  );
}
