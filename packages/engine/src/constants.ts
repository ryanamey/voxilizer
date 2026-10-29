/**
 * Voice model constants. These numbers define how Voxilizer sounds.
 * Changing them changes every render, so the reference tests in
 * `__tests__/render.test.ts` must be updated deliberately when they move.
 */

export const MODE_IDS = ["neutral", "curbing", "overdrive", "edge"] as const;
export type ModeId = (typeof MODE_IDS)[number];

export const EFFECT_IDS = ["none", "creak", "rattle", "growl", "grunt"] as const;
export type EffectId = (typeof EFFECT_IDS)[number];

/** The 11 Complete Vocal Technique main vowels, front (tongue on the upper molars) to back. */
export const VOWEL_IDS = ["EE", "I", "EH", "A", "OE", "UH", "AH", "OR", "OH", "O", "OO"] as const;
export type VowelId = (typeof VOWEL_IDS)[number];

/** The singer. CVT's pitch limits and voice parts differ between female and male voices. */
export const SINGER_IDS = ["female", "male"] as const;
export type SingerId = (typeof SINGER_IDS)[number];

/** Volume on CVT's 1–10 scale (1 = quietest you can sing, 10 = loudest). */
export const VOLUME_MIN = 1;
export const VOLUME_MAX = 10;

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
  neutral: {
    label: "Neutral",
    hint: "soft",
    oq: 0.74,
    cl: 0.45,
    tilt: 0.82,
    asp: 0.1,
    gain: 0.65,
    f1: 1.0,
    ring: 0.0,
  },
  curbing: {
    label: "Curbing",
    hint: "held",
    oq: 0.7,
    cl: 0.3,
    tilt: 0.12,
    asp: 0.04,
    gain: 0.8,
    f1: 0.97,
    ring: 3,
  },
  overdrive: {
    label: "Overdrive",
    hint: "shout",
    oq: 0.45,
    cl: 0.28,
    tilt: 0.08,
    asp: 0.02,
    gain: 1.0,
    f1: 1.12,
    ring: 1.3,
  },
  edge: {
    label: "Edge",
    hint: "sharp",
    oq: 0.38,
    cl: 0.18,
    tilt: 0.0,
    asp: 0.02,
    gain: 1.0,
    f1: 1.08,
    ring: 7,
  },
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

export interface VowelSpec {
  /** Example word, as CVT writes it. */
  word: string;
  /** IPA symbol. */
  ipa: string;
  /** First three formants (Hz) for an adult male voice. */
  formants: readonly [number, number, number];
}

/** CVT main vowels with approximate formants (adult male; scaled up for female voices). */
export const VOWELS: Record<VowelId, VowelSpec> = {
  EE: { word: "see", ipa: "i", formants: [280, 2250, 3000] },
  I: { word: "sit", ipa: "ɪ", formants: [400, 1950, 2550] },
  EH: { word: "stay", ipa: "e", formants: [480, 1900, 2500] },
  A: { word: "and", ipa: "æ", formants: [660, 1720, 2410] },
  OE: { word: "herb", ipa: "ɜː", formants: [500, 1400, 2300] },
  UH: { word: "hungry", ipa: "ʌ", formants: [620, 1200, 2390] },
  AH: { word: "far", ipa: "ɑ", formants: [730, 1090, 2440] },
  OR: { word: "order", ipa: "ɔː", formants: [570, 840, 2410] },
  OH: { word: "so", ipa: "o", formants: [500, 850, 2400] },
  O: { word: "woman", ipa: "ʊ", formants: [440, 1020, 2240] },
  OO: { word: "you", ipa: "u", formants: [310, 870, 2240] },
};

/** Vocal tract scale: female voices have shorter tracts and higher formants. */
export const SINGERS: Record<SingerId, { label: string; scale: number }> = {
  female: { label: "Female", scale: 1.16 },
  male: { label: "Male", scale: 1.0 },
};

/** Effect families that put the training stage at 3 or above. */
export const ARYEPIGLOTTIC_EFFECTS: readonly EffectId[] = ["growl", "rattle", "grunt"];
