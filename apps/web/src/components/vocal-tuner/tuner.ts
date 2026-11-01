/**
 * Vocal Tuner logic: turns a stream of pitch readings into what the singer sees. Pure, so it is
 * unit-tested without a microphone.
 */

/** 7 octaves, C1–B7. */
export const KEY_MIN = 24;
export const KEY_MAX = 107;
/** How long the singer must stay on the note. */
export const HOLD_MS = 2000;
/** Short detection dropouts or wobbles shorter than this don't break a hold. */
export const GRACE_MS = 150;
/** Readings smoothed together (a median, so one bad frame can't flip the note). */
const SMOOTH = 5;

export const TOLERANCES = {
  strict: { cents: 10, label: "Strict", hint: "±10 cents" },
  normal: { cents: 25, label: "Normal", hint: "±25 cents" },
  relaxed: { cents: 40, label: "Relaxed", hint: "±40 cents" },
} as const;
export type ToleranceId = keyof typeof TOLERANCES;

export type TunerStatus =
  /** No target chosen. */
  | "idle"
  /** Target chosen, nothing sung (or too quiet). */
  | "silent"
  /** A different note. */
  | "wrong-note"
  /** The target's note name in another octave. */
  | "wrong-octave"
  /** On the target key but outside the tolerance. */
  | "close"
  /** In tune, counting to HOLD_MS. */
  | "holding"
  /** Held for HOLD_MS. */
  | "locked";

export interface TunerState {
  status: TunerStatus;
  /** Smoothed sung pitch as a fractional MIDI number, or null when silent. */
  sung: number | null;
  /** The nearest key to the sung pitch. */
  sungKey: number | null;
  /** Distance from the target in cents (positive = sharp/above). */
  offCents: number | null;
  /** Milliseconds held in tune so far. */
  heldMs: number;
  /** When the current target was chosen and when it was locked (ms). */
  startedAt: number;
  lockedAt: number | null;
  // internal
  recent: number[];
  lastVoicedAt: number;
  holdStart: number | null;
  outSince: number | null;
  pending: number | null;
}

export function initialTuner(now: number, hasTarget: boolean): TunerState {
  return {
    status: hasTarget ? "silent" : "idle",
    sung: null,
    sungKey: null,
    offCents: null,
    heldMs: 0,
    startedAt: now,
    lockedAt: null,
    recent: [],
    lastVoicedAt: -Infinity,
    holdStart: null,
    outSince: null,
    pending: null,
  };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * Advance the tuner by one reading.
 * @param midi the detected pitch as a fractional MIDI number, or null for silence/noise
 */
export function tunerStep(
  prev: TunerState,
  midi: number | null,
  now: number,
  target: number | null,
  toleranceCents: number,
): TunerState {
  if (target === null) return { ...initialTuner(now, false) };

  let s: TunerState = { ...prev };
  if (midi !== null) {
    // A jump of more than a semitone starts a fresh window, so a new note shows up at once instead
    // of being averaged with the old one. The jump must be confirmed by a second reading, so a
    // single glitch (an octave error as a note stops) never reaches the screen.
    const jump = s.recent.length > 0 && Math.abs(midi - median(s.recent)) > 1;
    if (!jump) s.recent = [...s.recent, midi].slice(-SMOOTH);
    else if (s.pending !== null && Math.abs(midi - s.pending) < 0.5) s.recent = [s.pending, midi];
    else return { ...s, pending: midi, lastVoicedAt: now };
    s.pending = null;
    s.lastVoicedAt = now;
    s.sung = median(s.recent);
    s.sungKey = Math.round(s.sung);
    s.offCents = (s.sung - target) * 100;
  } else if (now - s.lastVoicedAt > GRACE_MS) {
    s = { ...s, recent: [], sung: null, sungKey: null, offCents: null };
  }

  if (s.status === "locked") return s;

  if (s.sung === null) {
    return { ...s, status: "silent", holdStart: null, outSince: null, heldMs: 0 };
  }

  const inTune = Math.abs(s.offCents!) <= toleranceCents;
  if (inTune) {
    const holdStart = s.holdStart ?? now;
    const heldMs = now - holdStart;
    if (heldMs >= HOLD_MS) return { ...s, status: "locked", holdStart, heldMs: HOLD_MS, lockedAt: now };
    return { ...s, status: "holding", holdStart, heldMs, outSince: null };
  }

  // Out of tune: keep a running hold through a brief wobble.
  const outSince = s.outSince ?? now;
  if (s.holdStart !== null && now - outSince <= GRACE_MS) {
    return { ...s, status: "holding", outSince, heldMs: now - s.holdStart };
  }
  const key = s.sungKey!;
  const status: TunerStatus =
    key === target ? "close" : (key - target) % 12 === 0 ? "wrong-octave" : "wrong-note";
  return { ...s, status, holdStart: null, heldMs: 0, outSince };
}

/** Which way to go: -1 = sing lower (arrow points left on the keyboard), 1 = higher, 0 = there. */
export function direction(state: Pick<TunerState, "offCents">, toleranceCents: number): -1 | 0 | 1 {
  if (state.offCents === null || Math.abs(state.offCents) <= toleranceCents) return 0;
  return state.offCents > 0 ? -1 : 1;
}

const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const isBlack = (midi: number) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
export const keyName = (midi: number) => `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

/** Plain-language distance, e.g. "9 semitones lower" or "an octave higher". */
export function distanceText(semitones: number): string {
  const n = Math.abs(semitones);
  const way = semitones > 0 ? "higher" : "lower";
  if (n === 12) return `an octave ${way}`;
  if (n === 24) return `two octaves ${way}`;
  return `${n} semitone${n === 1 ? "" : "s"} ${way}`;
}
