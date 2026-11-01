"use client";

import { AudioProvider } from "@/audio/audio-context";
import { DesignBar } from "./design-bar";
import { ToneDesigner } from "./tone-designer";
import { ToneKeyboard } from "./tone-keyboard";

/** Grit Lab: design a tone, hear it on any note, and save it to your library. */
export function GritLab() {
  return (
    <AudioProvider>
      <div className="flex flex-col gap-6">
        <DesignBar />
        <ToneDesigner />
        <ToneKeyboard />
        <p className="text-xs text-muted-foreground">
          The sound is a synthesised approximation for choosing a target. It doesn&apos;t show how the throat
          should feel, so never push your voice to copy it. Mode names follow Complete Vocal Technique
          terminology; stage rules are early heuristics.
        </p>
      </div>
    </AudioProvider>
  );
}
