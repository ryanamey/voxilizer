import { describe, expect, it } from "vitest";
import {
  analyzeVoice,
  DEFAULT_VOICE,
  magnitudeSpectrum,
  midiToHz,
  prepareTake,
  processVoice,
  renderTone,
  type Tone,
} from "../index";

const SR = 44100;
const clean: Tone = { mode: "curbing", volume: 6, air: 0, effect: "none", amount: 0, ff: 0 };
// A synthetic "take": a clean sung E3 rendered by the engine.
const take = renderTone(clean, "A", 52, DEFAULT_VOICE, 2.2, SR).samples;

describe("analyzeVoice", () => {
  it("finds the pitch of a steady sung note", () => {
    const an = analyzeVoice(take, SR);
    expect(an.voicedShare).toBeGreaterThan(0.6);
    // Within a semitone of E3 (164.8 Hz).
    expect(Math.abs(12 * Math.log2(an.medianF0 / midiToHz(52)))).toBeLessThan(1);
  });

  it("finds nothing in silence", () => {
    const an = analyzeVoice(new Float32Array(SR), SR);
    expect(an.medianF0).toBe(0);
  });
});

describe("processVoice", () => {
  const an = analyzeVoice(take, SR);

  it("returns finite, normalised audio of the same length for every effect", () => {
    for (const effect of ["none", "creak", "rattle", "growl", "grunt"] as const) {
      const y = processVoice(take, an, { ...clean, effect, amount: 70, ff: 40 }, { larynx: -40, twang: 50 });
      expect(y.length).toBe(take.length);
      let peak = 0,
        finite = true;
      for (const v of y) {
        if (!Number.isFinite(v)) finite = false;
        peak = Math.max(peak, Math.abs(v));
      }
      expect(finite).toBe(true);
      expect(peak).toBeCloseTo(0.85, 3);
    }
  });

  it("with no effect, closely reconstructs the take", () => {
    const y = processVoice(take, an, clean, { larynx: 0, twang: 0 });
    const x = prepareTake(take, SR)!;
    expect(x).not.toBeNull();
    // Compare spectra in the steady middle (robust to the DC blocker).
    const a = magnitudeSpectrum(y, SR, Math.floor(SR * 0.8)).db;
    const b = magnitudeSpectrum(take, SR, Math.floor(SR * 0.8)).db;
    let diff = 0,
      n = 0;
    for (let i = 5; i < a.length; i++)
      if (b[i]! > -40) {
        diff += Math.abs(a[i]! - b[i]!);
        n++;
      }
    expect(diff / n).toBeLessThan(3); // average under 3 dB on the strong bins
  });
});

describe("prepareTake", () => {
  it("rejects takes shorter than 0.4 s", () => {
    expect(prepareTake(new Float32Array(SR * 0.2).fill(0.5), SR)).toBeNull();
  });
});
