import type { Metadata } from "next";
import { StudioDemo } from "./studio-demo";

export const metadata: Metadata = { title: "Studio · Voxilizer" };

export default function StudioPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Step 1 · audio plumbing</p>
        <h1 className="text-3xl font-bold tracking-tight">Studio</h1>
        <p className="max-w-prose text-zinc-600 dark:text-zinc-400">
          The example phrase is synthesised by the Voxilizer engine in a background worker and played through an
          AudioWorklet. Each note shows its vowel, and the coloured stripe shows its training stage.
        </p>
      </header>
      <StudioDemo />
    </main>
  );
}
