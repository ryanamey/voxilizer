"use client";

import { GritLabAudioProvider } from "./audio-context";
import { MelodyStudio } from "./melody-studio";
import { SongBar } from "./song-bar";
import { ToneDesigner } from "./tone-designer";

/** Grit Lab: design a tone, write a melody, hear it and see its vocal load. */
export function GritLab() {
  return (
    <GritLabAudioProvider>
      <div className="flex flex-col gap-6">
        <SongBar />
        <ToneDesigner />
        <MelodyStudio />
        <p className="text-xs text-muted-foreground">
          The sound is a synthesised approximation for choosing a target. It doesn&apos;t show how the throat
          should feel, so never push your voice to copy it. Mode names follow Complete Vocal Technique
          terminology; stage rules are early heuristics.
        </p>
      </div>
    </GritLabAudioProvider>
  );
}
