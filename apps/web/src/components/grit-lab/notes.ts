import { PITCH_MAX, PITCH_MIN, STEPS_PER_BEAT, type Note } from "@voxilizer/engine";

/** Pure helpers for editing a melody. Kept free of React so they are easy to test. */

export const STEPS_PER_BAR = STEPS_PER_BEAT * 4;

export function newNoteId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Selected notes win: any unselected note they overlap on the same pitch row is
 * trimmed, split-free (the overlapped part is cut off), or removed if nothing is left.
 */
export function resolveOverlaps(notes: Note[], selected: ReadonlySet<string>): Note[] {
  const winners = notes.filter((n) => selected.has(n.id));
  let result = notes.map((n) => ({ ...n }));
  for (const w of winners) {
    result = result.filter((o) => {
      if (selected.has(o.id) || o.pitch !== w.pitch) return true;
      if (o.start + o.length <= w.start || o.start >= w.start + w.length) return true;
      if (o.start < w.start) {
        o.length = w.start - o.start;
        return o.length > 0;
      }
      const cut = w.start + w.length - o.start;
      o.start += cut;
      o.length -= cut;
      return o.length > 0;
    });
  }
  return result;
}

/** Move notes by (dStep, dPitch), clamped so the whole group stays inside the grid. */
export function clampMove(
  group: Note[],
  dStep: number,
  dPitch: number,
  totalSteps: number,
): { dStep: number; dPitch: number } {
  if (group.length === 0) return { dStep: 0, dPitch: 0 };
  const minS = Math.min(...group.map((n) => n.start));
  const maxE = Math.max(...group.map((n) => n.start + n.length));
  const minP = Math.min(...group.map((n) => n.pitch));
  const maxP = Math.max(...group.map((n) => n.pitch));
  return {
    dStep: Math.max(-minS, Math.min(totalSteps - maxE, dStep)),
    dPitch: Math.max(PITCH_MIN - minP, Math.min(PITCH_MAX - maxP, dPitch)),
  };
}

/** Drop notes past the end of the grid and trim notes that cross it. */
export function fitToBars(notes: Note[], bars: number): Note[] {
  const total = bars * STEPS_PER_BAR;
  return notes
    .filter((n) => n.start < total)
    .map((n) => ({ ...n, length: Math.min(n.length, total - n.start) }));
}
