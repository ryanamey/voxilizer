"use client";

import { AudioProvider } from "@/audio/audio-context";
import { MelodyStudio } from "./melody-studio";
import { SongBar } from "./song-bar";
import { SongTonePanel } from "./song-tone-panel";

/** Melody Studio: write a vocal line with library tones, hear it and see its vocal load. */
export function MelodyStudioPage() {
  return (
    <AudioProvider>
      <div className="flex flex-col gap-6">
        <SongBar />
        <SongTonePanel />
        <MelodyStudio />
        <p className="text-xs text-muted-foreground">
          The sound is a synthesised approximation for choosing a target. It doesn&apos;t show how the throat
          should feel, so never push your voice to copy it. Mode names follow Complete Vocal Technique
          terminology; stage rules are early heuristics.
        </p>
      </div>
    </AudioProvider>
  );
}
