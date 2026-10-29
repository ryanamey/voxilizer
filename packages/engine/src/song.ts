import { z } from "zod";
import { EFFECT_IDS, MODE_IDS, SINGER_IDS, VOLUME_MAX, VOLUME_MIN, VOWEL_IDS } from "./constants";

/** Lowest and highest MIDI pitch the editor allows (C2–C6). */
export const PITCH_MIN = 36;
export const PITCH_MAX = 84;
/** Grid resolution: steps per beat (16th notes). */
export const STEPS_PER_BEAT = 4;

/** What the singer does on a note: mode, volume, air and the added roughness. */
export const ToneSchema = z.object({
  mode: z.enum(MODE_IDS),
  /** CVT volume, 1 (quietest) to 10 (loudest). Each mode has its own healthy range. */
  volume: z.number().int().min(VOLUME_MIN).max(VOLUME_MAX),
  /** Audible air, 0–100. CVT: only in Neutral; ignored in the metallic modes. */
  air: z.number().min(0).max(100),
  effect: z.enum(EFFECT_IDS),
  /** Effect amount, 0–100. Ignored when effect is "none". */
  amount: z.number().min(0).max(100),
  /** Distortion (false-fold noise), 0–100. */
  ff: z.number().min(0).max(100),
});
export type Tone = z.infer<typeof ToneSchema>;

/** Whole-song settings: who sings, and the vocal-tract colour for every note. */
export const VoiceSettingsSchema = z.object({
  singer: z.enum(SINGER_IDS),
  /** -100 (lowered larynx, dark) to 100 (raised larynx, light). */
  larynx: z.number().min(-100).max(100),
  /** Twang above the "necessary twang" every note has: 0 = necessary only, 100 = distinct twang. */
  twang: z.number().min(0).max(100),
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
 * `parseSong` migrates every earlier version.
 */
export const SongSchema = z.object({
  version: z.literal(2),
  title: z.string(),
  tempo: z.number().min(40).max(240),
  bars: z.number().int().min(1).max(64),
  tone: ToneSchema,
  voice: VoiceSettingsSchema,
  notes: z.array(NoteSchema),
});
export type Song = z.infer<typeof SongSchema>;

// ---- version 1 (before CVT volume, singer and vowels) ----

const ToneV1 = z.object({
  mode: z.enum(MODE_IDS),
  effect: z.enum(EFFECT_IDS),
  amount: z.number().min(0).max(100),
  ff: z.number().min(0).max(100),
});
const SongV1 = z.object({
  version: z.literal(1),
  title: z.string(),
  tempo: z.number().min(40).max(240),
  bars: z.number().int().min(1).max(64),
  tone: ToneV1,
  voice: z.object({
    voice: z.enum(["low", "high"]),
    larynx: z.number().min(-100).max(100),
    twang: z.number().min(0).max(100),
    air: z.number().min(0).max(100),
  }),
  notes: z.array(
    z.object({
      id: z.string(),
      pitch: z.number().int(),
      start: z.number().int().min(0),
      length: z.number().int().min(1),
      vowel: z.enum(["A", "E", "I", "O", "U"]),
      tone: ToneV1.nullable(),
    }),
  ),
});

const V1_VOWEL = { A: "AH", E: "EH", I: "EE", O: "OH", U: "OO" } as const;
/** A typical volume for each mode, used when a song has none yet. */
export const MODE_VOLUME = { neutral: 3, curbing: 6, overdrive: 8, edge: 8 } as const;

function migrateV1(s: z.infer<typeof SongV1>): Song {
  const air = s.voice.air;
  const tone = (t: z.infer<typeof ToneV1>): Tone => ({
    ...t,
    volume: MODE_VOLUME[t.mode],
    air: t.mode === "neutral" ? air : 0,
  });
  return {
    version: 2,
    title: s.title,
    tempo: s.tempo,
    bars: s.bars,
    tone: tone(s.tone),
    voice: {
      singer: s.voice.voice === "high" ? "female" : "male",
      larynx: s.voice.larynx,
      twang: s.voice.twang,
    },
    notes: s.notes.map((n) => ({
      ...n,
      pitch: Math.min(PITCH_MAX, Math.max(PITCH_MIN, n.pitch)),
      vowel: V1_VOWEL[n.vowel],
      tone: n.tone ? tone(n.tone) : null,
    })),
  };
}

/** Parse a stored song of any version into the current format. Throws on invalid input. */
export function parseSong(input: unknown): Song {
  const version = (input as { version?: unknown } | null)?.version;
  if (version === 1) return SongSchema.parse(migrateV1(SongV1.parse(input)));
  return SongSchema.parse(input);
}

export const DEFAULT_TONE: Tone = { mode: "curbing", volume: 6, air: 0, effect: "none", amount: 40, ff: 0 };
export const DEFAULT_VOICE: VoiceSettings = { singer: "male", larynx: 0, twang: 20 };

/** The example rock phrase from the Grit Lab prototype, with CVT-correct vowels for a male voice. */
export function exampleSong(): Song {
  const t = (
    mode: Tone["mode"],
    volume: number,
    effect: Tone["effect"],
    amount: number,
    ff: number,
  ): Tone => ({
    mode,
    volume,
    air: 0,
    effect,
    amount,
    ff,
  });
  const raw: Array<[number, number, number, Note["vowel"], Tone | null]> = [
    [57, 0, 4, "AH", null],
    [60, 4, 2, "I", null],
    [62, 6, 2, "UH", null],
    [64, 8, 6, "O", null],
    [62, 16, 2, "I", null],
    [60, 18, 2, "UH", null],
    [57, 20, 8, "UH", t("curbing", 6, "growl", 50, 0)],
    [57, 32, 2, "I", null],
    [60, 34, 2, "UH", null],
    [64, 36, 4, "UH", null],
    [67, 40, 8, "I", t("edge", 8, "none", 0, 45)],
    [64, 48, 4, "UH", null],
    [62, 52, 2, "I", null],
    [60, 54, 2, "UH", null],
    [57, 56, 8, "OH", t("overdrive", 8, "growl", 45, 35)],
  ];
  return {
    version: 2,
    title: "Example phrase",
    tempo: 92,
    bars: 4,
    tone: t("curbing", 6, "none", 40, 0),
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
