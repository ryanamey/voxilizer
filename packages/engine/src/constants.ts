/**
 * Voice model constants. These numbers define how Voxilizer sounds.
 * Changing them changes every render, so the reference tests in
 * `__tests__/render.test.ts` must be updated deliberately when they move.
 */

export const MODE_IDS = ["neutral", "curbing", "overdrive", "edge"] as const;
export type ModeId = (typeof MODE_IDS)[number];

export const EFFECT_IDS = ["none", "creak", "rattle", "growl", "grunt"] as const;
export type EffectId = (typeof EFFECT_IDS)[number];

export const VOWEL_IDS = ["A", "E", "I", "O", "U"] as const;
export type VowelId = (typeof VOWEL_IDS)[number];

export const VOICE_IDS = ["low", "high"] as const;
export type VoiceId = (typeof VOICE_IDS)[number];

export interface ModeSpec {
  label: string;
  hint: string;
  /** Open quotient: share of each cycle the folds are open. */
  oq: number;
  /** Closing share of the open phase (smaller = sharper closure). */
  cl: number;
  /** One-pole low-pass amount on the source (higher = darker). */
  tilt: number;
  /** Baseline aspiration noise. */
  asp: number;
  /** Source gain. */
  gain: number;
  /** First-formant multiplier (louder modes open the mouth more). */
  f1: number;
  /** Amount of the ~3 kHz "ring" resonance. */
  ring: number;
}

/** Carrier modes. Labels follow Complete Vocal Technique terminology (to be licensed or renamed before launch). */
export const MODES: Record<ModeId, ModeSpec> = {
  neutral: { label: "Neutral", hint: "soft", oq: 0.72, cl: 0.45, tilt: 0.55, asp: 0.1, gain: 0.65, f1: 1.0, ring: 0.0 },
  curbing: { label: "Curbing", hint: "held", oq: 0.58, cl: 0.38, tilt: 0.32, asp: 0.04, gain: 0.8, f1: 0.97, ring: 0.1 },
  overdrive: { label: "Overdrive", hint: "shout", oq: 0.45, cl: 0.28, tilt: 0.14, asp: 0.02, gain: 1.0, f1: 1.12, ring: 0.15 },
  edge: { label: "Edge", hint: "sharp", oq: 0.38, cl: 0.22, tilt: 0.05, asp: 0.02, gain: 1.0, f1: 1.08, ring: 0.45 },
};

export interface EffectSpec {
  label: string;
  /** Vocal tract level where the effect is produced (CVT levels). */
  level: string;
}

export const EFFECTS: Record<EffectId, EffectSpec> = {
  none: { label: "None", level: "clean" },
  creak: { label: "Creak", level: "level 1" },
  rattle: { label: "Rattle", level: "level 3" },
  growl: { label: "Growl", level: "level 3" },
  grunt: { label: "Grunt", level: "level 3" },
};

/** First three formants (Hz) for an adult low voice. */
export const VOWELS: Record<VowelId, { hint: string; formants: readonly [number, number, number] }> = {
  A: { hint: "ah", formants: [730, 1090, 2440] },
  E: { hint: "eh", formants: [530, 1840, 2480] },
  I: { hint: "ee", formants: [300, 2250, 3000] },
  O: { hint: "oh", formants: [570, 860, 2410] },
  U: { hint: "oo", formants: [320, 870, 2240] },
};

/** Vocal tract scale: higher voices have shorter tracts and higher formants. */
export const VOICES: Record<VoiceId, { label: string; scale: number }> = {
  low: { label: "Lower", scale: 1.0 },
  high: { label: "Higher", scale: 1.16 },
};

/** Effect families that put the training stage at 3 or above. */
export const ARYEPIGLOTTIC_EFFECTS: readonly EffectId[] = ["growl", "rattle", "grunt"];
