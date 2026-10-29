import { describe, expect, it } from "vitest";
import {
  analyzeLoad,
  DEFAULT_VOICE,
  exampleSong,
  midiToHz,
  noteName,
  parseSong,
  renderMelody,
  renderTone,
  stageOf,
  type Tone,
} from "../index";

/** Energy at one frequency (Goertzel), over a steady middle section. */
function energyAt(x: Float32Array, freq: number, sr: number, from: number, len: number): number {
  const w = (2 * Math.PI * freq) / sr;
  const c = 2 * Math.cos(w);
  let s1 = 0,
    s2 = 0;
  for (let i = from; i < from + len; i++) {
    const s0 = x[i]! + c * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - c * s1 * s2;
}

const clean: Tone = { mode: "curbing", volume: 6, air: 0, effect: "none", amount: 0, ff: 0 };

describe("song format", () => {
  it("accepts the example song", () => {
    expect(() => parseSong(exampleSong())).not.toThrow();
  });
  it("rejects a pitch outside the editor range", () => {
    const s = exampleSong();
    s.notes[0]!.pitch = 100;
    expect(() => parseSong(s)).toThrow();
  });
});

describe("pitch helpers", () => {
  it("maps A4 to 440 Hz and names notes", () => {
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(noteName(57)).toBe("A3");
    expect(noteName(61)).toBe("C♯4");
  });
});

describe("renderMelody", () => {
  const song = exampleSong();
  const opts = { tempo: song.tempo, songTone: song.tone, voice: song.voice };

  it("returns null for an empty melody", () => {
    expect(renderMelody([], opts)).toBeNull();
  });

  it("renders finite audio that never exceeds 0.85 peak", () => {
    const r = renderMelody(song.notes, opts)!;
    expect(r.samples.length).toBeGreaterThan(r.sampleRate * 10);
    let peak = 0;
    let finite = true;
    for (const v of r.samples) {
      if (!Number.isFinite(v)) finite = false;
      peak = Math.max(peak, Math.abs(v));
    }
    expect(finite).toBe(true);
    expect(peak).toBeLessThanOrEqual(0.8501);
    expect(peak).toBeGreaterThan(0.3);
  });

  it("is deterministic for the same input and seed", () => {
    const a = renderMelody(song.notes, { ...opts, seed: 5 })!;
    const b = renderMelody(song.notes, { ...opts, seed: 5 })!;
    expect(a.samples).toEqual(b.samples);
  });
});

describe("effects leave their acoustic fingerprint", () => {
  const sr = 44100;
  const pitch = 52; // E3, ~165 Hz
  const f0 = midiToHz(pitch);
  const from = Math.floor(sr * 0.8),
    len = Math.floor(sr * 0.8);
  const ratio = (tone: Tone) => {
    const x = renderTone(tone, "A", pitch, DEFAULT_VOICE).samples;
    return energyAt(x, f0 / 2, sr, from, len) / energyAt(x, f0, sr, from, len);
  };

  it("growl adds a sub-harmonic at half the pitch", () => {
    const growl: Tone = { ...clean, effect: "growl", amount: 80 };
    expect(ratio(growl)).toBeGreaterThan(ratio(clean) * 10);
  });
});

describe("training stages and load", () => {
  it("maps tones to stages", () => {
    expect(stageOf(clean)).toBe(0);
    expect(stageOf({ ...clean, effect: "creak", amount: 30 })).toBe(1);
    expect(stageOf({ ...clean, ff: 30 })).toBe(2);
    expect(stageOf({ ...clean, effect: "growl", amount: 30 })).toBe(3);
    expect(stageOf({ ...clean, effect: "growl", amount: 30, ff: 20 })).toBe(4);
    expect(stageOf({ ...clean, ff: 90 })).toBe(4);
  });

  it("reports the example song's load", () => {
    const report = analyzeLoad(exampleSong());
    expect(report.heaviestStage).toBe(4);
    expect(report.noteStages["n7"]).toBe(3);
    expect(report.noteStages["n15"]).toBe(4);
    expect(report.roughShare).toBeGreaterThan(0);
    expect(report.roughShare).toBeLessThan(1);
    expect(report.warnings.some((w) => w.kind === "stage-4")).toBe(true);
  });

  it("warns about long rough runs without recovery", () => {
    const song = exampleSong();
    song.tone = { mode: "edge", volume: 8, air: 0, effect: "none", amount: 0, ff: 40 };
    expect(analyzeLoad(song).warnings.some((w) => w.kind === "long-rough-run")).toBe(true);
  });
});
