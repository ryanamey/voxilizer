import { z } from "zod";
import {
  DENSITY_IDS,
  EFFECT_IDS,
  MODE_DENSITIES,
  MODE_IDS,
  SINGER_IDS,
  VOLUME_MAX,
  VOLUME_MIN,
  VOWEL_IDS,
  type DensityId,
  type ModeId,
} from "./constants";

/** Lowest and highest MIDI pitch the editor allows (C2–C6). */
export const PITCH_MIN = 36;
export const PITCH_MAX = 84;
/** Grid resolution: steps per beat (16th notes). */
export const STEPS_PER_BEAT = 4;

/** What the singer does on a note: mode, volume, air and the added roughness. */
export const ToneSchema = z.object({
  mode: z.enum(MODE_IDS),
  /** CVT density. Songs saved before density existed default to the mode's usual density. */
  density: z.enum(DENSITY_IDS).optional(),
  /** CVT volume, 1 (quietest) to 10 (loudest). Each mode has its own healthy range. */
  volume: z.number().int().min(VOLUME_MIN).max(VOLUME_MAX),
  /** Audible air, 0–100. CVT: only in Neutral; ignored in the metallic modes. */
  air: z.number().min(0).max(100),
  effect: z.enum(EFFECT_IDS),
  /** Effect amount, 0–100. Ignored when effect is "none". */
  amount: z.number().min(0).max(100),
  /** Distortion (false-fold noise), 0–100. */
  ff: z.number().min(0).max(100),
  /** Larynx height: -100 (lowered, dark) to 100 (raised, light). Missing = 0. */
  larynx: z.number().min(-100).max(100).optional(),
  /** Twang above the "necessary twang" every note has: 0 = necessary only, 100 = distinct. Missing = 20. */
  twang: z.number().min(0).max(100).optional(),
  /**
   * Where this tone came from, when it was picked from the singer's tone library. Songs keep a copy
   * of the tone; `savedAt` lets the app notice when the library version has changed since.
   */
  origin: z
    .object({ id: z.string().max(64), name: z.string().max(80), savedAt: z.string().max(40) })
    .optional(),
});
export type Tone = z.infer<typeof ToneSchema>;
export type ToneOrigin = NonNullable<Tone["origin"]>;

/** Whole-song settings: who sings. (Larynx and twang belong to each tone since format v3.) */
export const VoiceSettingsSchema = z.object({
  singer: z.enum(SINGER_IDS),
});
export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;

export const DEFAULT_LARYNX = 0;
export const DEFAULT_TWANG = 20;

/** A tone's vocal-tract colour, with defaults filled in. */
export function tractOf(tone: Pick<Tone, "larynx" | "twang">): { larynx: number; twang: number } {
  return { larynx: tone.larynx ?? DEFAULT_LARYNX, twang: tone.twang ?? DEFAULT_TWANG };
}

/** The sound of a tone only: what two tones must share to sound the same (no origin label). */
export function soundOf(tone: Tone): Omit<Tone, "origin"> {
  const { origin: _origin, ...sound } = tone;
  void _origin;
  return { ...sound, ...tractOf(tone), density: densityOf(sound) };
}

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
  version: z.literal(3),
  title: z.string(),
  tempo: z.number().min(40).max(240),
  bars: z.number().int().min(1).max(64),
  tone: ToneSchema,
  voice: VoiceSettingsSchema,
  notes: z.array(NoteSchema),
});
export type Song = z.infer<typeof SongSchema>;

// ---- version 2 (larynx and twang were song-wide) ----

const SongV2 = z.object({
  version: z.literal(2),
  title: z.string(),
  tempo: z.number().min(40).max(240),
  bars: z.number().int().min(1).max(64),
  tone: ToneSchema,
  voice: z.object({
    singer: z.enum(SINGER_IDS),
    larynx: z.number().min(-100).max(100),
    twang: z.number().min(0).max(100),
  }),
  notes: z.array(NoteSchema),
});
type SongV2 = z.infer<typeof SongV2>;

function migrateV2(s: SongV2): Song {
  const tract = { larynx: s.voice.larynx, twang: s.voice.twang };
  return {
    ...s,
    version: 3,
    tone: { ...s.tone, ...tract },
    voice: { singer: s.voice.singer },
    notes: s.notes.map((n) => ({ ...n, tone: n.tone ? { ...n.tone, ...tract } : null })),
  };
}

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

/** The density a tone is sung in: its own if the mode allows it, otherwise the mode's usual one. */
export function densityOf(tone: Pick<Tone, "mode" | "density">): DensityId {
  const allowed = MODE_DENSITIES[tone.mode];
  return tone.density && allowed.includes(tone.density) ? tone.density : allowed[0]!;
}

/** A typical volume for a mode in a density (reduced-density metal sits at medium volume). */
export function typicalVolume(mode: ModeId, density: DensityId): number {
  if (density === "reduced" && (mode === "overdrive" || mode === "edge")) return 6;
  if (density === "falsetto") return 3;
  return MODE_VOLUME[mode];
}

function migrateV1(s: z.infer<typeof SongV1>): SongV2 {
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
  if (version === 1) return SongSchema.parse(migrateV2(SongV2.parse(migrateV1(SongV1.parse(input)))));
  if (version === 2) return SongSchema.parse(migrateV2(SongV2.parse(input)));
  return SongSchema.parse(input);
}

export const DEFAULT_TONE: Tone = {
  mode: "curbing",
  density: "reduced",
  volume: 6,
  air: 0,
  effect: "none",
  amount: 40,
  ff: 0,
  larynx: DEFAULT_LARYNX,
  twang: DEFAULT_TWANG,
};
export const DEFAULT_VOICE: VoiceSettings = { singer: "male" };

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
    density: mode === "curbing" ? "reduced" : "fuller",
    volume,
    air: 0,
    effect,
    amount,
    ff,
    larynx: DEFAULT_LARYNX,
    twang: DEFAULT_TWANG,
  });
  const raw: Array<[number, number, number, Note["vowel"], Tone | null]> = [
    [57, 0, 4, "AH", null],
    [60, 4, 2, "OO", null],
    [62, 6, 2, "UH", null],
    [64, 8, 6, "O", null],
    [62, 16, 2, "OO", null],
    [60, 18, 2, "UH", null],
    [57, 20, 8, "UH", t("curbing", 6, "growl", 50, 0)],
    [57, 32, 2, "I", null],
    [60, 34, 2, "UH", null],
    [64, 36, 4, "UH", null],
    [67, 40, 8, "I", t("edge", 8, "none", 0, 45)],
    [64, 48, 4, "UH", null],
    [62, 52, 2, "OO", null],
    [60, 54, 2, "UH", null],
    [57, 56, 8, "OH", t("overdrive", 8, "growl", 45, 35)],
  ];
  return {
    version: 3,
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
