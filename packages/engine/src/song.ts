import { z } from "zod";
import { EFFECT_IDS, MODE_IDS, VOICE_IDS, VOWEL_IDS } from "./constants";

/** Lowest and highest MIDI pitch the editor allows (E2–D5). */
export const PITCH_MIN = 40;
export const PITCH_MAX = 74;
/** Grid resolution: steps per beat (16th notes). */
export const STEPS_PER_BEAT = 4;

/** What the singer does on a note: carrier mode plus the added roughness. */
export const ToneSchema = z.object({
  mode: z.enum(MODE_IDS),
  effect: z.enum(EFFECT_IDS),
  /** Effect amount, 0–100. Ignored when effect is "none". */
  amount: z.number().min(0).max(100),
  /** False-fold (ventricular) distortion, 0–100. */
  ff: z.number().min(0).max(100),
});
export type Tone = z.infer<typeof ToneSchema>;

/** Whole-song settings that shape the vocal tract for every note. */
export const VoiceSettingsSchema = z.object({
  voice: z.enum(VOICE_IDS),
  /** -100 (low, dark) to 100 (high, bright). */
  larynx: z.number().min(-100).max(100),
  /** Aryepiglottic narrowing, 0–100. */
  twang: z.number().min(0).max(100),
  /** Breathiness, 0–100. */
  air: z.number().min(0).max(100),
});
export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;

export const NoteSchema = z.object({
  id: z.string(),
  /** MIDI pitch. */
  pitch: z.number().int().min(PITCH_MIN).max(PITCH_MAX),
  /** Start, in grid steps (16th notes). */
  start: z.number().int().min(0),
  /** Length, in grid steps. */
  length: z.number().int().min(1),
  vowel: z.enum(VOWEL_IDS),
  /** Per-note override. `null` means the note follows the song tone. */
  tone: ToneSchema.nullable(),
});
export type Note = z.infer<typeof NoteSchema>;

/**
 * The saved song format. `version` is bumped on every breaking change and
 * `migrateSong` must be able to read every earlier version.
 */
export const SongSchema = z.object({
  version: z.literal(1),
  title: z.string(),
  tempo: z.number().min(40).max(240),
  bars: z.number().int().min(1).max(64),
  tone: ToneSchema,
  voice: VoiceSettingsSchema,
  notes: z.array(NoteSchema),
});
export type Song = z.infer<typeof SongSchema>;

export function parseSong(input: unknown): Song {
  return SongSchema.parse(input);
}

export const DEFAULT_TONE: Tone = { mode: "curbing", effect: "none", amount: 40, ff: 0 };
export const DEFAULT_VOICE: VoiceSettings = { voice: "low", larynx: 0, twang: 20, air: 0 };

/** The example rock phrase from the Grit Lab prototype. */
export function exampleSong(): Song {
  const raw: Array<[number, number, number, Note["vowel"], Tone | null]> = [
    [57, 0, 4, "A", null],
    [60, 4, 2, "E", null],
    [62, 6, 2, "A", null],
    [64, 8, 6, "O", null],
    [62, 16, 2, "I", null],
    [60, 18, 2, "A", null],
    [57, 20, 8, "A", { mode: "curbing", effect: "growl", amount: 50, ff: 0 }],
    [57, 32, 2, "E", null],
    [60, 34, 2, "A", null],
    [64, 36, 4, "A", null],
    [67, 40, 8, "O", { mode: "edge", effect: "none", amount: 0, ff: 45 }],
    [64, 48, 4, "A", null],
    [62, 52, 2, "E", null],
    [60, 54, 2, "A", null],
    [57, 56, 8, "O", { mode: "overdrive", effect: "growl", amount: 45, ff: 35 }],
  ];
  return {
    version: 1,
    title: "Example phrase",
    tempo: 92,
    bars: 4,
    tone: { mode: "curbing", effect: "none", amount: 40, ff: 0 },
    voice: { ...DEFAULT_VOICE },
    notes: raw.map(([pitch, start, length, vowel, tone], i) => ({
      id: `n${i + 1}`,
      pitch,
      start,
      length,
      vowel,
      tone,
    })),
  };
}
