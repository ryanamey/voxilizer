import { ARYEPIGLOTTIC_EFFECTS } from "./constants";
import type { Note, Song, Tone, VoiceSettings } from "./song";
import { STEPS_PER_BEAT } from "./song";

/**
 * Training stage a tone belongs to (see the research doc's development framework):
 * 0 foundations/clean · 1 true-fold texture · 2 false-fold family ·
 * 3 aryepiglottic family · 4 integration / high load.
 * These are prototype heuristics for coaches to refine.
 */
export type Stage = 0 | 1 | 2 | 3 | 4;

export function stageOf(tone: Tone, voice: Pick<VoiceSettings, "air">): Stage {
  const amount = tone.effect === "none" ? 0 : tone.amount;
  const aryepiglottic = ARYEPIGLOTTIC_EFFECTS.includes(tone.effect) && amount > 0;
  let s: Stage = 0;
  if (voice.air > 40 || (tone.effect === "creak" && amount > 0)) s = 1;
  if (tone.ff > 0) s = Math.max(s, 2) as Stage;
  if (aryepiglottic) s = Math.max(s, 3) as Stage;
  if (tone.ff > 0 && aryepiglottic) s = 4;
  if (amount > 75 || tone.ff > 75) s = 4;
  return s;
}

/** The tone a note is actually sung with. */
export function effectiveTone(note: Note, songTone: Tone): Tone {
  return note.tone ?? songTone;
}

export interface LoadWarning {
  kind: "long-rough-run" | "stage-4";
  message: string;
  /** Seconds from the start of the song. */
  from?: number;
  to?: number;
}

export interface LoadReport {
  sungSeconds: number;
  roughSeconds: number;
  /** Share of sung time with an effect (stage ≥ 2), 0–1. */
  roughShare: number;
  heaviestStage: Stage;
  /** Stage per note id. */
  noteStages: Record<string, Stage>;
  warnings: LoadWarning[];
}

/** A rough run longer than this, with no clean note between, triggers a warning. */
export const LONG_ROUGH_RUN_SECONDS = 6;
/** A gap longer than this between rough notes counts as recovery. */
const RECOVERY_GAP_SECONDS = 1;

export function analyzeLoad(song: Song): LoadReport {
  const spb = 60 / song.tempo / STEPS_PER_BEAT;
  const sorted = [...song.notes].sort((a, b) => a.start - b.start);
  const noteStages: Record<string, Stage> = {};
  let sung = 0;
  let rough = 0;
  let heaviest: Stage = 0;
  let run = 0;
  let runStart = 0;
  let lastEnd = -1;
  let worst = { len: 0, from: 0, to: 0 };

  for (const n of sorted) {
    const stage = stageOf(effectiveTone(n, song.tone), song.voice);
    noteStages[n.id] = stage;
    heaviest = Math.max(heaviest, stage) as Stage;
    const dur = n.length * spb;
    sung += dur;
    const gap = lastEnd >= 0 ? (n.start - lastEnd) * spb : 0;
    if (stage >= 2) {
      rough += dur;
      if (run === 0 || gap > RECOVERY_GAP_SECONDS) {
        run = 0;
        runStart = n.start * spb;
      }
      run += dur + (run > 0 ? Math.max(0, gap) : 0);
      if (run > worst.len) worst = { len: run, from: runStart, to: (n.start + n.length) * spb };
    } else {
      run = 0;
    }
    lastEnd = n.start + n.length;
  }

  const warnings: LoadWarning[] = [];
  if (worst.len > LONG_ROUGH_RUN_SECONDS) {
    warnings.push({
      kind: "long-rough-run",
      from: worst.from,
      to: worst.to,
      message: `${worst.len.toFixed(1)} s of rough singing in a row with no clean note between. Put a clean phrase in there to let the voice recover.`,
    });
  }
  if (heaviest >= 4) {
    warnings.push({
      kind: "stage-4",
      message: "Stage 4+ notes: build each source alone before you sing this combination.",
    });
  }

  return {
    sungSeconds: sung,
    roughSeconds: rough,
    roughShare: sung > 0 ? rough / sung : 0,
    heaviestStage: heaviest,
    noteStages,
    warnings,
  };
}

/** Plain-language notes for the tone designer: why a setting is heavy or unusual. */
export function toneNotes(
  tone: Tone,
  voice: VoiceSettings,
  pitchHz: number,
  fromRecording = false,
): string[] {
  const notes: string[] = [];
  const amount = tone.effect === "none" ? 0 : tone.amount;
  const aryepiglottic = ARYEPIGLOTTIC_EFFECTS.includes(tone.effect) && amount > 0;
  const high = fromRecording ? pitchHz > 400 : voice.voice === "low" ? pitchHz > 300 : pitchHz > 520;
  if (tone.ff > 0 && aryepiglottic)
    notes.push("Two noise sources at once: learn each alone before stacking them.");
  if (amount > 75 || tone.ff > 75)
    notes.push("High effect amount: reach it in small steps from 5–10%, in short reps.");
  if (tone.effect === "grunt" && amount > 0 && high)
    notes.push("Grunts are usually low in the range. A high grunt here is a sound experiment, not a target.");
  if (fromRecording) {
    notes.push(
      "This preview adds the effect to your clean take. In real singing your technique produces it, so treat it as a direction, not proof you're ready.",
    );
  } else {
    if (tone.mode === "neutral" && tone.ff > 50)
      notes.push(
        "Heavy distortion on a soft, breathy carrier is uncommon; most singers put it on a firmer carrier.",
      );
    if (tone.mode === "edge" && high && tone.ff > 60)
      notes.push("High, sharp and heavily distorted is the heaviest-load corner. Build it last.");
    if (voice.larynx < -60 && tone.mode === "edge")
      notes.push("Edge usually rides a raised larynx; a very low larynx pulls against it.");
  }
  notes.push(
    "Use this as a target to hear, then follow the staged lessons. Don't force your voice to match it.",
  );
  return notes;
}
