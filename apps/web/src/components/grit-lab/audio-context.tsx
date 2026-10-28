"use client";

import { createContext, use, useEffect, useMemo, useState, type ReactNode } from "react";
import { AudioEngine, type RenderedAudio } from "@/audio/audio-engine";

export type PlayingKind = "tone" | "melody" | "selection" | null;

interface AudioState {
  engine: AudioEngine;
  /** What is currently playing, if anything. */
  playing: PlayingKind;
  play: (audio: RenderedAudio, kind: Exclude<PlayingKind, null>) => Promise<void>;
  playSequence: (clips: RenderedAudio[], kind: Exclude<PlayingKind, null>) => Promise<void>;
  stop: () => void;
}

const Ctx = createContext<AudioState | null>(null);
/** Kept separate so the ~30 Hz position updates only re-render what shows a playhead. */
const PositionCtx = createContext(-1);

/** One AudioEngine (context + worklet + worker) shared by every Grit Lab panel. */
export function GritLabAudioProvider({ children }: { children: ReactNode }) {
  const [engine] = useState(() => new AudioEngine());
  const [playing, setPlaying] = useState<PlayingKind>(null);
  const [position, setPosition] = useState(-1);

  useEffect(() => {
    const unlisten = engine.listen({
      onPosition: (s) => setPosition(s),
      onEnded: () => {
        setPlaying(null);
        setPosition(-1);
      },
    });
    return () => {
      unlisten();
      void engine.dispose();
    };
  }, [engine]);

  const value = useMemo<AudioState>(
    () => ({
      engine,
      playing,
      play: async (audio, kind) => {
        await engine.play(audio);
        setPlaying(kind);
        setPosition(0);
      },
      playSequence: async (clips, kind) => {
        await engine.playSequence(clips);
        setPlaying(kind);
        setPosition(0);
      },
      stop: () => engine.stop(),
    }),
    [engine, playing],
  );

  return (
    <Ctx value={value}>
      <PositionCtx value={position}>{children}</PositionCtx>
    </Ctx>
  );
}

export function useGritLabAudio(): AudioState {
  const v = use(Ctx);
  if (!v) throw new Error("useGritLabAudio must be used inside GritLabAudioProvider");
  return v;
}

/** Playback position in seconds, or -1 when stopped. */
export function usePlaybackPosition(): number {
  return use(PositionCtx);
}
