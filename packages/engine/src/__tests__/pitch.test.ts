import { describe, expect, it } from "vitest";
import { DEFAULT_VOICE, detectPitch, midiToHz, MODE_IDS, nearestNote, renderTone, type Tone } from "../index";

const SR = 48000;
const frame = (fn: (t: number) => number, n = 2048) => Float32Array.from({ length: n }, (_, i) => fn(i / SR));
const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

describe("detectPitch", () => {
  it("finds a pure tone across the singing range", () => {
    for (const hz of [65.4, 110, 261.6, 440, 880, 1318.5]) {
      const r = detectPitch(
        frame((t) => 0.3 * Math.sin(2 * Math.PI * hz * t)),
        SR,
      )!;
      expect(Math.abs(cents(r.hz, hz))).toBeLessThan(3);
    }
  });

  it("follows the fundamental when the second harmonic is stronger", () => {
    const hz = 196;
    const x = frame(
      (t) =>
        0.15 * Math.sin(2 * Math.PI * hz * t) +
        0.3 * Math.sin(2 * Math.PI * 2 * hz * t) +
        0.1 * Math.sin(2 * Math.PI * 3 * hz * t),
    );
    expect(Math.abs(cents(detectPitch(x, SR)!.hz, hz))).toBeLessThan(5);
  });

  it("reads synthesised singing in each mode", () => {
    for (const [mode, pitch] of [
      ["neutral", 48],
      ["curbing", 57],
      ["overdrive", 52],
      ["edge", 69],
    ] as const) {
      const tone: Tone = { mode, volume: 7, air: 0, effect: "none", amount: 0, ff: 0 };
      const r = renderTone(tone, "AH", pitch, DEFAULT_VOICE);
      const from = Math.floor(r.sampleRate * 0.8);
      const reading = detectPitch(r.samples.subarray(from, from + 2048), r.sampleRate)!;
      expect(nearestNote(reading.hz).midi).toBe(pitch);
    }
  });

  it("names the right note across modes, vowels and both voices", () => {
    let total = 0,
      right = 0;
    for (const singer of ["male", "female"] as const)
      for (const mode of MODE_IDS)
        for (const vowel of ["AH", "EE", "OO"] as const)
          for (const pitch of singer === "male" ? [40, 52, 64] : [57, 67, 76]) {
            const tone: Tone = { mode, volume: 7, air: 0, effect: "none", amount: 0, ff: 0 };
            const r = renderTone(tone, vowel, pitch, { ...DEFAULT_VOICE, singer });
            const from = Math.floor(r.sampleRate * 0.8);
            const reading = detectPitch(r.samples.subarray(from, from + 2048), r.sampleRate);
            total++;
            if (reading && nearestNote(reading.hz).midi === pitch) right++;
          }
    expect(right / total).toBeGreaterThanOrEqual(0.98);
  });

  it("is fast enough for 60 readings a second", () => {
    const x = frame((t) => 0.3 * Math.sin(2 * Math.PI * 220 * t));
    const start = performance.now();
    for (let i = 0; i < 30; i++) detectPitch(x, SR);
    expect((performance.now() - start) / 30).toBeLessThan(8);
  });

  it("ignores silence and noise", () => {
    expect(detectPitch(new Float32Array(2048), SR)).toBeNull();
    let s = 1;
    const noise = frame(() => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 0.4);
    expect(detectPitch(noise, SR)).toBeNull();
  });

  it("names notes and cents", () => {
    expect(nearestNote(440)).toEqual({ midi: 69, cents: 0 });
    const n = nearestNote(midiToHz(60) * Math.pow(2, 20 / 1200));
    expect(n.midi).toBe(60);
    expect(n.cents).toBeCloseTo(20, 5);
  });
});
