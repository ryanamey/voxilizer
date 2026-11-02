import { describe, expect, it } from "vitest";
import { detectPitch, nearestNote } from "@voxilizer/engine";
import { MIX_POOL, nextMix, renderTimbre, type RenderedNote } from "../timbres";

const SR = 48000;

/** Pitch readings (MIDI with cents) every ~40 ms from `from` to `to` seconds. */
function readings(x: Float32Array, from: number, to: number) {
  const found: number[] = [];
  for (let at = Math.floor(SR * from); at + 4096 < Math.min(x.length, SR * to); at += 2048) {
    const r = detectPitch(x.subarray(at, at + 4096), SR, { minRms: 0.002 });
    if (r) found.push(69 + 12 * Math.log2(r.hz / 440));
  }
  return found;
}
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

/** A looped note as it is heard: the lead-in, then the loop three times. */
function unroll(n: RenderedNote): Float32Array {
  if (!n.loop) return n.samples;
  const { start, end } = n.loop;
  const loop = n.samples.subarray(start, end);
  const out = new Float32Array(start + loop.length * 3);
  out.set(n.samples.subarray(0, start));
  for (let k = 0; k < 3; k++) out.set(loop, start + k * loop.length);
  return out;
}

describe("reference timbres", () => {
  for (const sustain of [false, true])
    for (const sound of MIX_POOL)
      it(`${sound}${sustain ? " (sustained)" : ""} plays exactly the note asked for`, () => {
        for (const midi of [40, 48, 57, 64, 72, 81]) {
          const m = median(
            readings(
              unroll(renderTimbre(sound, midi, SR, midi >= 60 ? "female" : "male", sustain)),
              0.15,
              1.1,
            ),
          );
          expect(m, `${sound} at ${midi}`).toBeDefined();
          expect(nearestNote(440 * Math.pow(2, (m! - 69) / 12)).midi).toBe(midi);
          // Within 5 cents: well below what a singer can hear.
          expect(Math.abs(m! - midi) * 100).toBeLessThan(5);
        }
      }, 30_000);

  it("holds Clean and Voice in tune across the loop, with no click", () => {
    for (const sound of ["clean", "voice"] as const)
      for (const midi of [43, 57, 69, 79]) {
        const note = renderTimbre(sound, midi, SR, "female", true);
        expect(note.loop).toBeDefined();
        const x = unroll(note);
        // Every reading over three loop passes stays on pitch: the pure tone exactly, the voice
        // within its own natural movement (it wobbles about ±20 cents around the note, like a
        // real singer, with or without the loop).
        const r = readings(x, 0.6, x.length / SR);
        expect(r.length).toBeGreaterThan(50);
        const limit = sound === "clean" ? 3 : 25;
        for (const v of r) expect(Math.abs(v - midi) * 100, `${sound} ${midi}`).toBeLessThan(limit);
        expect(Math.abs(median(r)! - midi) * 100, `${sound} ${midi} median`).toBeLessThan(5);
        // The step across the wrap is no bigger than the note's ordinary sample-to-sample steps.
        const { start, end } = note.loop!;
        let maxStep = 0;
        for (let i = start + 1; i < end; i++)
          maxStep = Math.max(maxStep, Math.abs(note.samples[i]! - note.samples[i - 1]!));
        const wrap = Math.abs(note.samples[start]! - note.samples[end - 1]!);
        expect(wrap, `${sound} ${midi} wrap`).toBeLessThanOrEqual(maxStep * 1.05);
      }
  }, 30_000);

  it("keeps short notes short and sustained notes long", () => {
    for (const sound of MIX_POOL) {
      expect(renderTimbre(sound, 57, SR, "male").samples.length / SR).toBeLessThan(2);
      const held = renderTimbre(sound, 57, SR, "male", true);
      expect(held.loop || held.samples.length / SR >= 6).toBeTruthy();
    }
  });

  it("Mix never repeats the same timbre twice in a row", () => {
    let prev = nextMix(null);
    for (let i = 0; i < 50; i++) {
      const next = nextMix(prev);
      expect(next).not.toBe(prev);
      prev = next;
    }
  });
});
