import { describe, expect, it } from "vitest";
import { detectPitch, nearestNote } from "@voxilizer/engine";
import { MIX_POOL, nextMix, renderTimbre } from "../timbres";

const SR = 48000;

/** Median pitch (as MIDI with cents) over the note's first second, the part a singer listens to. */
function measured(x: Float32Array) {
  const found: number[] = [];
  for (let at = Math.floor(SR * 0.15); at + 4096 < Math.min(x.length, SR * 1.1); at += 2048) {
    const r = detectPitch(x.subarray(at, at + 4096), SR, { minRms: 0.002 });
    if (r) found.push(69 + 12 * Math.log2(r.hz / 440));
  }
  found.sort((a, b) => a - b);
  return found[found.length >> 1];
}

describe("reference timbres", () => {
  for (const sound of MIX_POOL)
    it(`${sound} plays exactly the note asked for`, () => {
      for (const midi of [40, 48, 57, 64, 72, 81]) {
        const m = measured(renderTimbre(sound, midi, SR, midi >= 60 ? "female" : "male"));
        expect(m, `${sound} at ${midi}`).toBeDefined();
        expect(nearestNote(440 * Math.pow(2, (m! - 69) / 12)).midi).toBe(midi);
        // Within 5 cents: well below what a singer can hear.
        expect(Math.abs(m! - midi) * 100).toBeLessThan(5);
      }
    }, 20_000);

  it("Mix never repeats the same timbre twice in a row", () => {
    let prev = nextMix(null);
    for (let i = 0; i < 50; i++) {
      const next = nextMix(prev);
      expect(next).not.toBe(prev);
      prev = next;
    }
  });
});
