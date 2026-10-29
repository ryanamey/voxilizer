/**
 * Complete Vocal Technique rules: the 2012 book updated with the current CVT app
 * edition ("Updates in relation to the English book edition from 2012"): density,
 * falsetto, Overdrive's D5 limit for women, Curbing vowels UH/O/OO, Highway/Byway
 * transitions. Turns a designed tone into advice: is this note singable in the
 * centre of its mode, and if not, what would make it so?
 *
 * These are CVT's pedagogical rules, not physiology facts. They are shown as
 * guidance; the singer and their teacher decide. Source notes: project doc
 * `claude/cvt-2012-reading-notes.md`.
 */
import {
  DENSITIES,
  MODE_DENSITIES,
  MODES,
  VOWELS,
  type DensityId,
  type ModeId,
  type SingerId,
  type VowelId,
} from "./constants";
import { densityOf, typicalVolume, type Note, type Song, type Tone, type VoiceSettings } from "./song";
import { noteName } from "./util";

// ---------------------------------------------------------------------------
// Parts of the voice (CVT replaces "registers" with pitch areas)
// ---------------------------------------------------------------------------

export const VOICE_PARTS = ["very-low", "low", "middle", "high", "very-high"] as const;
export type VoicePart = (typeof VOICE_PARTS)[number];

export const VOICE_PART_LABEL: Record<VoicePart, string> = {
  "very-low": "very low part",
  low: "low part",
  middle: "middle part",
  high: "high part",
  "very-high": "very high part",
};

/** MIDI note where the low part starts: C3 for women, C2 for men. Each part is one octave. */
const LOW_PART_START: Record<SingerId, number> = { female: 48, male: 36 };

export function voicePart(pitch: number, singer: SingerId): VoicePart {
  const i = Math.floor((pitch - LOW_PART_START[singer]) / 12) + 1;
  return VOICE_PARTS[Math.max(0, Math.min(4, i))]!;
}

const isHigh = (part: VoicePart) => part === "high" || part === "very-high";

// ---------------------------------------------------------------------------
// Pitch limits
// ---------------------------------------------------------------------------

/** Highest note in Overdrive: D5 for women (lowered from E♭5 in the current edition), C5 for men. */
export const OVERDRIVE_TOP: Record<SingerId, number> = { female: 62, male: 72 };

/** Curbing is used in all pitches except, for women, above high C (C6). */
export const CURBING_TOP_FEMALE = 84;

// ---------------------------------------------------------------------------
// Vowels
// ---------------------------------------------------------------------------

export type VowelFit = "easy" | "ok" | "hard" | "avoid";

/**
 * Which vowels keep each mode in the high part of the voice. In the low part all vowels work.
 * Current edition: Curbing's vowels are UH, O, OO; I can be sung in Curbing but isn't taught as a
 * Curbing vowel, because it also belongs to Edge, which has different volume possibilities.
 */
const MODE_VOWELS: Record<
  ModeId,
  { easy: readonly VowelId[]; ok?: readonly VowelId[]; hard: readonly VowelId[] }
> = {
  neutral: { easy: ["EE", "I", "EH", "A", "OE", "UH", "AH", "OR", "OH", "O", "OO"], hard: [] },
  curbing: { easy: ["UH", "O", "OO"], ok: ["I"], hard: ["EE", "A", "AH", "OE", "OR"] },
  overdrive: { easy: ["EH", "OH"], hard: [] },
  edge: { easy: ["I", "EH", "A", "OE"], hard: ["EE", "UH"] },
};

export function vowelFit(vowel: VowelId, mode: ModeId): VowelFit {
  const v = MODE_VOWELS[mode];
  if (v.easy.includes(vowel)) return "easy";
  if (v.ok?.includes(vowel)) return "ok";
  return v.hard.includes(vowel) ? "hard" : "avoid";
}

/** CVT's vowel alterations: what to actually sing in the high part to stay in the mode. */
const ALTER: Record<Exclude<ModeId, "neutral">, Record<VowelId, VowelId>> = {
  curbing: {
    EE: "UH",
    I: "I",
    EH: "UH",
    A: "UH",
    OE: "UH",
    UH: "UH",
    AH: "UH",
    OR: "O",
    OH: "O",
    O: "O",
    OO: "OO",
  },

  overdrive: {
    EE: "EH",
    I: "EH",
    EH: "EH",
    A: "EH",
    OE: "EH",
    UH: "OH",
    AH: "OH",
    OR: "OH",
    OH: "OH",
    O: "OH",
    OO: "OH",
  },
  edge: {
    EE: "I",
    I: "I",
    EH: "EH",
    A: "A",
    OE: "OE",
    UH: "A",
    AH: "A",
    OR: "OE",
    OH: "OE",
    O: "OE",
    OO: "OE",
  },
};

/** The vowel to sing for a written vowel in this mode at this pitch. */
export function sungVowel(vowel: VowelId, mode: ModeId, pitch: number, singer: SingerId): VowelId {
  if (mode === "neutral" || !isHigh(voicePart(pitch, singer))) return vowel;
  return ALTER[mode][vowel];
}

// ---------------------------------------------------------------------------
// Volume
// ---------------------------------------------------------------------------

export const VOLUME_LABEL = ["", "pp", "pp", "p", "mp", "mp", "mf", "mf", "f", "ff", "ff"] as const;

/** CVT: Neutral 1–4, Curbing 4–7, Overdrive and Edge 7–10 (4–7 in reduced density). */
export const MODE_VOLUME_RANGE: Record<ModeId, readonly [number, number]> = {
  neutral: [1, 4],
  curbing: [4, 7],
  overdrive: [7, 10],
  edge: [7, 10],
};

/** The healthy volume range for a mode in a density, at a pitch area. */
export function volumeRange(mode: ModeId, density: DensityId, part?: VoicePart): readonly [number, number] {
  if (mode === "neutral") {
    if (density === "falsetto") return part && isHigh(part) ? [1, 7] : [1, 4];
    if (!part) return [1, 4];
    // Current edition: medium (4–7) is possible in the middle part with lots of twang; loud in the high part.
    return isHigh(part) ? [1, 10] : part === "middle" ? [1, 7] : [1, 4];
  }
  if (mode === "curbing") return [4, 7];
  if (density === "reduced") return [4, 7];
  // Fuller-density Overdrive/Edge: loud; a little quieter is possible in the low part.
  return part === "low" || part === "very-low" ? [5, 10] : [7, 10];
}

/** Plain-language range for the volume slider. */
export function volumeRangeText(mode: ModeId, density: DensityId): string {
  const label = `${MODES[mode].label}${mode === "curbing" ? "" : ` (${DENSITIES[density].label.toLowerCase()})`}`;
  if (mode === "neutral" && density !== "falsetto")
    return `${label} sits at volume 1–4; up to 7 in the middle part with plenty of twang, and loud only in the high part.`;
  const [lo, hi] = volumeRange(mode, density);
  return `${label} sits at volume ${lo}–${hi}.`;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export type CheckSeverity = "avoid" | "caution" | "tip";

export interface CheckFix {
  label: string;
  vowel?: VowelId;
  tone?: Partial<Tone>;
}

export interface Check {
  /** Stable id of the rule, for tests and analytics. */
  rule: string;
  severity: CheckSeverity;
  title: string;
  detail: string;
  fix?: CheckFix;
}

const SEVERITY_ORDER: Record<CheckSeverity, number> = { avoid: 0, caution: 1, tip: 2 };

export function worstSeverity(checks: readonly Check[]): CheckSeverity | null {
  let w: CheckSeverity | null = null;
  for (const c of checks) if (!w || SEVERITY_ORDER[c.severity] < SEVERITY_ORDER[w]) w = c.severity;
  return w;
}

const vowelName = (v: VowelId) => `${v} (as in "${VOWELS[v].word}")`;

/** Check one note (or the tone designer's preview) against CVT's rules. */
export function checkNote(note: Pick<Note, "pitch" | "vowel">, tone: Tone, voice: VoiceSettings): Check[] {
  const out: Check[] = [];
  const { mode, volume } = tone;
  const density = densityOf(tone);
  const singer = voice.singer;
  const part = voicePart(note.pitch, singer);
  const label = MODES[mode].label;
  const metallic = mode !== "neutral";

  // Air belongs to Neutral only.
  if (metallic && tone.air > 0) {
    out.push({
      rule: "air-in-metal",
      severity: "avoid",
      title: `No air in ${label}`,
      detail:
        "CVT: audible air works only in Neutral. Trying to add air to a metallic mode can cause strong constriction.",
      fix: { label: "Remove the air", tone: { air: 0 } },
    });
  }

  // Pitch ceilings.
  if (mode === "overdrive" && note.pitch > OVERDRIVE_TOP[singer]) {
    out.push({
      rule: "overdrive-too-high",
      severity: "avoid",
      title: "Above Overdrive's limit",
      detail: `Overdrive stops at ${noteName(OVERDRIVE_TOP[singer])} for ${singer === "female" ? "women" : "men"}. For this much power up here, CVT uses Edge.`,
      fix: { label: "Switch to Edge", tone: { mode: "edge" }, vowel: ALTER.edge[note.vowel] },
    });
  }
  if (mode === "curbing" && singer === "female" && note.pitch > CURBING_TOP_FEMALE) {
    out.push({
      rule: "curbing-too-high",
      severity: "avoid",
      title: "Above Curbing's range",
      detail: "Women don't use Curbing above high C. Up here, use Neutral or Edge.",
      fix: { label: "Switch to Edge", tone: { mode: "edge" }, vowel: ALTER.edge[note.vowel] },
    });
  }

  // Falsetto low down.
  if (density === "falsetto" && (part === "low" || part === "very-low")) {
    out.push({
      rule: "falsetto-low",
      severity: "tip",
      title: "Falsetto gets harder down here",
      detail:
        "Neutral in falsetto exists in all pitches, but it gets more and more difficult in the lower part of the voice.",
    });
  }

  // Vowels in the high part.
  const fit = vowelFit(note.vowel, mode);
  if (metallic && fit === "ok" && isHigh(part)) {
    out.push({
      rule: "vowel-ok",
      severity: "tip",
      title: `${note.vowel} sits between Curbing and Edge`,
      detail:
        "I can be sung in Curbing, but CVT teaches Curbing on UH, O and OO: on I the voice is easily drawn into Edge, which is louder.",
      fix: { label: "Sing UH", vowel: "UH" },
    });
  }
  if (metallic && (fit === "hard" || fit === "avoid")) {
    const sung = ALTER[mode][note.vowel];
    if (isHigh(part)) {
      out.push({
        rule: fit === "avoid" ? "vowel-breaks-mode" : "vowel-hard",
        severity: fit === "avoid" ? "avoid" : "caution",
        title:
          fit === "avoid"
            ? `${note.vowel} can't hold ${label} up here`
            : `${note.vowel} is hard in ${label} up here`,
        detail: `In the ${VOICE_PART_LABEL[part]}, ${label} needs ${MODE_VOWELS[mode].easy.join(", ")}. Sing ${vowelName(sung)} instead; listeners rarely notice.`,
        fix: sung !== note.vowel ? { label: `Sing ${sung}`, vowel: sung } : undefined,
      });
    } else if (part === "middle" && fit === "avoid") {
      out.push({
        rule: "vowel-direct",
        severity: "tip",
        title: `Lean ${note.vowel} towards ${sung}`,
        detail: `${label} gets easier as you direct ${note.vowel} towards ${vowelName(sung)}, more so the higher you go.`,
        fix: { label: `Sing ${sung}`, vowel: sung },
      });
    }
  }

  // Volume (depends on mode, density and pitch area).
  const [lo, hi] = volumeRange(mode, density, part);
  if (mode === "neutral") {
    if (tone.air > 0 && volume > 4) {
      out.push({
        rule: "air-too-loud",
        severity: "caution",
        title: "Too loud for audible air",
        detail:
          "Neutral with audible air tops out around mp (volume 4). Louder means forcing air through the folds.",
        fix: { label: "Volume 4", tone: { volume: 4 } },
      });
    } else if (volume > hi) {
      const falsetto = density === "falsetto";
      out.push({
        rule: falsetto ? "falsetto-too-loud" : "neutral-too-loud",
        severity: !falsetto && volume >= 8 ? "avoid" : "caution",
        title: falsetto ? "Too loud for falsetto" : "Too loud for Neutral here",
        detail: falsetto
          ? "Falsetto is the light, 'disengaged' way of singing; pushing it louder tends to split or break the voice."
          : `In the ${VOICE_PART_LABEL[part]}, Neutral only reaches volume ${hi}. Louder strains the voice; for this volume use a metallic mode.`,
        fix: falsetto
          ? { label: "Fuller density", tone: { density: "fuller" } }
          : volume >= 8
            ? { label: "Switch to Overdrive", tone: { mode: "overdrive", density: "fuller", air: 0 } }
            : { label: "Switch to Curbing", tone: { mode: "curbing", air: 0 } },
      });
    } else if (part === "middle" && volume > 4 && voice.twang < 40 && density !== "falsetto") {
      out.push({
        rule: "neutral-medium-twang",
        severity: "tip",
        title: "Medium Neutral needs twang",
        detail: "Medium volume in Neutral works in the middle part when combined with plenty of twang.",
        fix: undefined,
      });
    }
  } else if (mode === "curbing") {
    if (volume > hi) {
      out.push({
        rule: "curbing-too-loud",
        severity: volume >= 9 ? "avoid" : "caution",
        title: "Too loud for Curbing",
        detail:
          "Curbing stays around medium volume. Pushing it louder while keeping the 'hold' strains the voice; for loud singing use Overdrive or Edge.",
        fix: {
          label: isHigh(part) ? "Switch to Edge" : "Switch to Overdrive",
          tone: { mode: isHigh(part) ? "edge" : "overdrive", density: "fuller" },
        },
      });
    } else if (volume < lo) {
      out.push({
        rule: "curbing-too-quiet",
        severity: "caution",
        title: "Too quiet for Curbing",
        detail:
          "Below medium-quiet, Curbing loses its metal and slips into Neutral. Letting go of support in quiet Curbing makes the voice sore.",
        fix: { label: "Switch to Neutral", tone: { mode: "neutral", density: "reduced" } },
      });
    }
  } else if (density === "fuller") {
    if (volume < lo) {
      out.push({
        rule: "metal-too-quiet",
        severity: isHigh(part) && volume < 4 ? "avoid" : "caution",
        title: `Too quiet for fuller ${label}`,
        detail: `Fuller-density ${label} is loud, and the higher you sing, the louder it gets. For medium volume, sing it in reduced density (contained, 'held-in'), or change mode.`,
        fix:
          volume >= 4
            ? { label: "Reduced density", tone: { density: "reduced" } }
            : { label: "Switch to Neutral", tone: { mode: "neutral", density: "fuller" } },
      });
    }
  } else if (volume > hi || volume < lo) {
    out.push({
      rule: volume > hi ? "reduced-too-loud" : "reduced-too-quiet",
      severity: "caution",
      title: volume > hi ? `Too loud for reduced ${label}` : `Too quiet for reduced ${label}`,
      detail:
        volume > hi
          ? `Reduced density is the medium-volume version of ${label}. For loud singing, use fuller density.`
          : `Below medium volume, metal is hard to keep. Use Neutral for quiet singing.`,
      fix:
        volume > hi
          ? { label: "Fuller density", tone: { density: "fuller" } }
          : { label: "Switch to Neutral", tone: { mode: "neutral", density: "reduced" } },
    });
  }

  // Sound colour inside the metallic modes.
  if (mode === "edge" && voice.larynx < -20) {
    out.push({
      rule: "edge-dark",
      severity: "caution",
      title: "Edge with a lowered larynx",
      detail:
        "Edge needs a raised larynx and distinct twang. Lowering the larynx loses the twang and can hurt. The lighter a metallic mode, the safer.",
      fix: undefined,
    });
  } else if (metallic && voice.larynx < -50) {
    out.push({
      rule: "metal-dark",
      severity: "caution",
      title: `Very dark ${label}`,
      detail:
        "Darkening a metallic mode raises the risk of breaks and constriction. Only colour it this dark when the mode itself is secure.",
    });
  }
  if (mode === "edge" && voice.twang < 30) {
    out.push({
      rule: "edge-twang",
      severity: "tip",
      title: "Edge lives on distinct twang",
      detail: "If Edge ever hurts, it usually isn't twanged enough: more twang, higher larynx, wider smile.",
    });
  }

  // Effects.
  const hasEffect = tone.effect !== "none" && tone.amount > 0;
  if (tone.ff > 0 && voice.larynx < -20) {
    out.push({
      rule: "distortion-dark",
      severity: "caution",
      title: "Distortion with a lowered larynx",
      detail:
        "CVT finds distortion with lots of twang, a raised larynx and a light colour. A low larynx makes it scratch or hurt.",
    });
  }
  if (tone.effect === "grunt" && hasEffect && isHigh(part)) {
    out.push({
      rule: "grunt-high",
      severity: "tip",
      title: "Grunt is a low-voice effect",
      detail:
        "Grunt is mostly used in the low part. Higher up, support more and raise the larynx; don't let the tongue drop.",
    });
  }
  if ((hasEffect || tone.ff > 0) && mode !== "neutral" && volume >= 9) {
    out.push({
      rule: "effect-volume",
      severity: "tip",
      title: "Effects cost volume",
      detail:
        "Adding an effect usually lowers the volume and needs extra support. Expect this note to come out a little quieter.",
    });
  }

  return out;
}

/** Modes that can change smoothly, and the vowels they share in the high part. */
const MUTUAL: Record<string, readonly VowelId[]> = {
  "neutral>curbing": ["UH", "O", "OO"],
  "neutral>overdrive": ["EH", "OH"],
  "neutral>edge": ["I", "EH", "A", "OE"],
  "curbing>edge": ["I", "A", "UH"],
  "curbing>overdrive": ["O", "OH"],
  "overdrive>edge": ["EH"],
};
const pairKey = (a: ModeId, b: ModeId) => {
  const order: ModeId[] = ["neutral", "curbing", "overdrive", "edge"];
  return order.indexOf(a) < order.indexOf(b) ? `${a}>${b}` : `${b}>${a}`;
};

/** Advice for the change between two neighbouring notes (Highway, Byway and vocal breaks). */
function transitionCheck(prev: Note, pt: Tone, n: Note, tone: Tone, song: Song): Check | null {
  const pd = densityOf(pt),
    d = densityOf(tone);
  const from = `${MODES[pt.mode].label}${pt.mode === "curbing" ? "" : ` (${DENSITIES[pd].label.toLowerCase()})`}`;
  const to = `${MODES[tone.mode].label}${tone.mode === "curbing" ? "" : ` (${DENSITIES[d].label.toLowerCase()})`}`;
  if ((pd === "falsetto") !== (d === "falsetto")) {
    return {
      rule: "transition-break",
      severity: "tip",
      title: `${from} → ${to} is a vocal break`,
      detail:
        "In CVT, a vocal break is always a change to or from Neutral in falsetto. Great as an intentional effect; for a smooth line, use fuller or reduced Neutral instead.",
    };
  }
  if (pt.mode === tone.mode && pd === d) return null;
  if (pt.mode === "neutral" && pt.air > 0 && tone.mode !== "neutral") {
    return {
      rule: "transition-air",
      severity: "tip",
      title: "From airy Neutral into metal",
      detail: `Remove the air first: go through Neutral without audible air before ${to}, or the change will be audible.`,
    };
  }
  const modes = new Set([pt.mode, tone.mode]);
  const metal = (m: ModeId) => m === "overdrive" || m === "edge";
  // Highway: fuller metal ↔ fuller Neutral. Byway: reduced metal ↔ Curbing ↔ reduced Neutral.
  if (modes.has("neutral") && [...modes].some(metal)) {
    const metalD = metal(pt.mode) ? pd : d,
      neutralD = pt.mode === "neutral" ? pd : d;
    if (metalD !== neutralD)
      return {
        rule: "transition-path",
        severity: "tip",
        title: `Match the density for a smooth ${from} → ${to}`,
        detail:
          metalD === "fuller"
            ? "CVT's Highway connects fuller-density metal with fuller-density Neutral. Use fuller Neutral here, or reduced-density metal (Byway)."
            : "CVT's Byway connects reduced-density metal with reduced-density Neutral, through Curbing. Use reduced Neutral here, or fuller-density metal (Highway).",
      };
  }
  if (modes.has("curbing") && [...modes].some(metal)) {
    const metalD = metal(pt.mode) ? pd : d;
    if (metalD === "fuller")
      return {
        rule: "transition-path",
        severity: "tip",
        title: `${from} → ${to}: go through reduced density`,
        detail:
          "Curbing lives on CVT's Byway (reduced density). To move between Curbing and fuller-density metal smoothly, pass through reduced-density Overdrive or Edge.",
      };
  }
  if (isHigh(voicePart(n.pitch, song.voice.singer)) && pt.mode !== tone.mode) {
    const shared = MUTUAL[pairKey(pt.mode, tone.mode)] ?? [];
    const v = sungVowel(n.vowel, tone.mode, n.pitch, song.voice.singer);
    if (!shared.includes(v))
      return {
        rule: "transition-audible",
        severity: "tip",
        title: `${from} → ${to} will be audible`,
        detail: shared.length
          ? `For a smooth change up here, use a vowel both modes share: ${shared.join(", ")}.`
          : "These modes don't share a vowel up here; the change will be heard.",
      };
  }
  return null;
}

export interface SongCheck {
  notes: Record<string, Check[]>;
  counts: Record<CheckSeverity, number>;
}

/** Check every note of a song, including the mode changes between neighbouring notes. */
export function checkSong(song: Song): SongCheck {
  const notes: Record<string, Check[]> = {};
  const counts: Record<CheckSeverity, number> = { avoid: 0, caution: 0, tip: 0 };
  const sorted = [...song.notes].sort((a, b) => a.start - b.start);
  let prev: Note | null = null;
  for (const n of sorted) {
    const tone = n.tone ?? song.tone;
    const list = checkNote(n, tone, song.voice);

    if (prev && n.start - (prev.start + prev.length) <= 4) {
      const t = transitionCheck(prev, prev.tone ?? song.tone, n, tone, song);
      if (t) list.push(t);
    }

    if (list.length) {
      notes[n.id] = list;
      for (const c of list) counts[c.severity]++;
    }
    prev = n;
  }
  return { notes, counts };
}

/**
 * Change a tone's mode or density the CVT way: keep a density the mode allows, keep the
 * volume if it suits the result, otherwise move to a typical volume, and drop air in metal.
 */
export function toneWithMode(tone: Tone, mode: ModeId, density?: DensityId): Tone {
  const allowed = MODE_DENSITIES[mode];
  const d = density && allowed.includes(density) ? density : densityOf({ mode, density: tone.density });
  const [lo, hi] = volumeRange(mode, d);
  const volume =
    mode === "neutral" && d !== "falsetto"
      ? Math.min(tone.volume, 4) === tone.volume
        ? tone.volume
        : typicalVolume(mode, d)
      : tone.volume >= lo && tone.volume <= hi
        ? tone.volume
        : typicalVolume(mode, d);
  return { ...tone, mode, density: d, volume, air: mode === "neutral" ? tone.air : 0 };
}

/** Apply a tone patch, routing mode and density changes through `toneWithMode`. */
export function patchTone(tone: Tone, patch: Partial<Tone>): Tone {
  const { mode, density, ...rest } = patch;
  const changes = (mode && mode !== tone.mode) || (density && density !== densityOf(tone));
  const base = changes ? toneWithMode(tone, mode ?? tone.mode, density ?? tone.density) : tone;
  return { ...base, ...rest };
}
