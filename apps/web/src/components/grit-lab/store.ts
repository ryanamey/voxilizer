"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import {
  DEFAULT_TONE,
  patchTone,
  soundOf,
  type SingerId,
  type Tone,
  type ToneOrigin,
  type VowelId,
} from "@voxilizer/engine";
import type { SavedToneData } from "@/lib/validation/tones";

export type Source = "synth" | "mine";
export type Pattern = "sustain" | "phrase";

export interface Preview {
  /** MIDI pitch of the designer's preview note. */
  pitch: number;
  vowel: VowelId;
  pattern: Pattern;
}

/** Where a tone opened from Melody Studio should go back to. */
export type EditTarget =
  { kind: "song"; songTitle: string } | { kind: "notes"; ids: string[]; songTitle: string };

export interface GritLabState {
  /** The tone being designed, larynx and twang included. Undo/redo tracks this and the singer. */
  tone: Tone;
  singer: SingerId;
  preview: Preview;
  source: Source;
  /** The library tone this design was loaded from or last saved as. */
  loaded: ToneOrigin | null;
  /** JSON of the design as last saved or loaded, to detect unsaved changes. */
  savedJson: string;
  /** Set when Melody Studio sent a tone here to edit. */
  target: EditTarget | null;

  setTone: (patch: Partial<Tone>) => void;
  setSinger: (singer: SingerId) => void;
  setPreview: (patch: Partial<Preview>) => void;
  setSource: (source: Source) => void;
  /** Open a tone (from the library, or from a song) for editing. */
  openTone: (
    tone: Tone,
    opts?: { singer?: SingerId; preview?: Partial<Preview>; target?: EditTarget | null },
  ) => void;
  markSaved: (origin: ToneOrigin) => void;
  setTarget: (target: EditTarget | null) => void;
  newDesign: () => void;
}

/** The parts of a design that a save keeps. */
export function designData(s: Pick<GritLabState, "tone" | "singer" | "preview">): SavedToneData {
  return {
    version: 1,
    tone: soundOf(s.tone),
    singer: s.singer,
    preview: { vowel: s.preview.vowel, pitch: s.preview.pitch },
  };
}
const designJson = (s: Pick<GritLabState, "tone" | "singer" | "preview">) => JSON.stringify(designData(s));

const START_TONE: Tone = {
  ...DEFAULT_TONE,
  mode: "overdrive",
  density: "fuller",
  volume: 8,
  larynx: 10,
  twang: 30,
};

export const useGritLab = create<GritLabState>()(
  temporal(
    (set, get) => ({
      tone: START_TONE,
      singer: "male",
      preview: { pitch: 52, vowel: "AH", pattern: "sustain" },
      source: "synth",
      loaded: null,
      savedJson: "",
      target: null,

      setTone: (patch) => set({ tone: patchTone(get().tone, patch) }),
      setSinger: (singer) => set({ singer }),
      setPreview: (patch) => set({ preview: { ...get().preview, ...patch } }),
      setSource: (source) => set({ source }),
      openTone: (tone, opts = {}) => {
        const { origin, ...sound } = tone;
        const next = {
          tone: soundOf(sound),
          singer: opts.singer ?? get().singer,
          preview: { ...get().preview, ...opts.preview },
        };
        set({
          ...next,
          loaded: origin ?? null,
          savedJson: origin ? designJson(next) : "",
          target: opts.target === undefined ? get().target : opts.target,
        });
        useGritLab.temporal.getState().clear();
      },
      markSaved: (origin) => set({ loaded: origin, savedJson: designJson(get()) }),
      setTarget: (target) => set({ target }),
      newDesign: () => {
        set({ tone: START_TONE, loaded: null, savedJson: "", target: null });
        useGritLab.temporal.getState().clear();
      },
    }),
    {
      partialize: (s) => ({ tone: s.tone, singer: s.singer }),
      equality: (a, b) => a.tone === b.tone && a.singer === b.singer,
      limit: 100,
      // One undo step per burst (e.g. dragging a slider), keeping the state from before it.
      handleSet: (handleSet) => {
        let last = 0;
        return (...args: Parameters<typeof handleSet>) => {
          const now = Date.now();
          if (now - last > 400) handleSet(...args);
          last = now;
        };
      },
    },
  ),
);

/** True when the design differs from the library tone it was loaded from or saved as. */
export function useDesignDirty(): boolean {
  return useGritLab((s) => (s.loaded ? designJson(s) !== s.savedJson : false));
}
