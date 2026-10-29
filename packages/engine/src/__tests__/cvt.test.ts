import { describe, expect, it } from "vitest";
import {
  checkNote,
  checkSong,
  DEFAULT_VOICE,
  exampleSong,
  magnitudeSpectrum,
  parseSong,
  renderTone,
  sungVowel,
  voicePart,
  type Tone,
  type VoiceSettings,
} from "../index";

const male: VoiceSettings = { ...DEFAULT_VOICE, singer: "male" };
const female: VoiceSettings = { ...DEFAULT_VOICE, singer: "female" };
const tone = (t: Partial<Tone>): Tone => ({
  mode: "curbing",
  volume: 6,
  air: 0,
  effect: "none",
  amount: 0,
  ff: 0,
  ...t,
});
const rules = (checks: { rule: string }[]) => checks.map((c) => c.rule);

describe("song format v2", () => {
  it("migrates a version 1 song", () => {
    const v1 = {
      version: 1,
      title: "Old",
      tempo: 100,
      bars: 2,
      tone: { mode: "neutral", effect: "none", amount: 0, ff: 0 },
      voice: { voice: "high", larynx: 10, twang: 30, air: 25 },
      notes: [
        { id: "a", pitch: 60, start: 0, length: 4, vowel: "A", tone: null },
        {
          id: "b",
          pitch: 64,
          start: 4,
          length: 4,
          vowel: "I",
          tone: { mode: "edge", effect: "none", amount: 0, ff: 30 },
        },
      ],
    };
    const s = parseSong(v1);
    expect(s.version).toBe(2);
    expect(s.voice).toEqual({ singer: "female", larynx: 10, twang: 30 });
    expect(s.tone.air).toBe(25); // Neutral keeps the old air
    expect(s.notes[1]!.tone!.air).toBe(0); // Edge never gets air
    expect(s.notes[1]!.tone!.volume).toBe(8);
    expect(s.notes.map((n) => n.vowel)).toEqual(["AH", "EE"]);
  });

  it("accepts the example song", () => {
    expect(() => parseSong(exampleSong())).not.toThrow();
  });
});

describe("parts of the voice", () => {
  it("uses CVT's pitch areas for women and men", () => {
    expect(voicePart(60, "female")).toBe("middle"); // C4
    expect(voicePart(72, "female")).toBe("high"); // C5
    expect(voicePart(60, "male")).toBe("high"); // C4
    expect(voicePart(72, "male")).toBe("very-high"); // C5
    expect(voicePart(40, "male")).toBe("low");
  });
});

describe("CVT checks", () => {
  it("flags air in a metallic mode", () => {
    expect(
      rules(checkNote({ pitch: 55, vowel: "EH" }, tone({ mode: "overdrive", volume: 8, air: 20 }), male)),
    ).toContain("air-in-metal");
  });

  it("knows Overdrive's ceiling for each voice", () => {
    const od = tone({ mode: "overdrive", volume: 9 });
    expect(rules(checkNote({ pitch: 72, vowel: "EH" }, od, male))).not.toContain("overdrive-too-high");
    expect(rules(checkNote({ pitch: 64, vowel: "EH" }, od, female))).toContain("overdrive-too-high");
    const fix = checkNote({ pitch: 64, vowel: "AH" }, od, female).find(
      (c) => c.rule === "overdrive-too-high",
    )!.fix!;
    expect(fix.tone?.mode).toBe("edge");
    expect(fix.vowel).toBe("A");
  });

  it("asks for the mode's vowels in the high part only", () => {
    const od = tone({ mode: "overdrive", volume: 9 });
    expect(rules(checkNote({ pitch: 64, vowel: "EE" }, od, male))).toContain("vowel-breaks-mode");
    expect(rules(checkNote({ pitch: 45, vowel: "EE" }, od, male))).not.toContain("vowel-breaks-mode");
    expect(sungVowel("OO", "overdrive", 64, "male")).toBe("OH");
    expect(sungVowel("OO", "edge", 64, "male")).toBe("OE");
    expect(sungVowel("OO", "overdrive", 45, "male")).toBe("OO");
  });

  it("keeps each mode in its volume range", () => {
    expect(rules(checkNote({ pitch: 55, vowel: "UH" }, tone({ volume: 9 }), male))).toContain(
      "curbing-too-loud",
    );
    expect(rules(checkNote({ pitch: 55, vowel: "UH" }, tone({ volume: 2 }), male))).toContain(
      "curbing-too-quiet",
    );
    expect(rules(checkNote({ pitch: 64, vowel: "I" }, tone({ mode: "edge", volume: 4 }), male))).toContain(
      "metal-too-quiet",
    );
    expect(
      rules(checkNote({ pitch: 52, vowel: "AH" }, tone({ mode: "neutral", volume: 8 }), male)),
    ).toContain("neutral-too-loud");
    // Loud Neutral is fine in the high part.
    expect(
      rules(checkNote({ pitch: 66, vowel: "AH" }, tone({ mode: "neutral", volume: 8 }), male)),
    ).not.toContain("neutral-too-loud");
  });

  it("passes a tone in the centre of its mode", () => {
    expect(
      checkNote({ pitch: 64, vowel: "EH" }, tone({ mode: "edge", volume: 8 }), { ...male, twang: 50 }),
    ).toEqual([]);
  });

  it("checks a whole song and its mode changes", () => {
    const report = checkSong(exampleSong());
    expect(report.counts.avoid + report.counts.caution + report.counts.tip).toBeGreaterThan(0);
  });
});

describe("volume", () => {
  it("renders quieter notes at a lower level", () => {
    const peak = (v: number) => {
      const x = renderTone(tone({ mode: "neutral", volume: v }), "AH", 52, male).samples;
      let p = 0;
      for (const s of x) p = Math.max(p, Math.abs(s));
      return p;
    };
    expect(peak(2)).toBeLessThan(peak(10) * 0.3);
  });
});

describe("mode calibration against the CVT Sound Library", () => {
  // Measured on CVT M 056/072/097/120: the 3 kHz "ring" rises Neutral < Curbing < Overdrive < Edge.
  const ring = (mode: Tone["mode"], volume: number, vowel: "EH" | "I") => {
    const r = renderTone(tone({ mode, volume }), vowel, 54, male);
    const { db, binHz } = magnitudeSpectrum(
      r.samples,
      r.sampleRate,
      Math.floor(r.sampleRate * 0.8),
      8192,
      5000,
    );
    let band = 0,
      all = 0;
    db.forEach((d, i) => {
      const p = Math.pow(10, d / 10);
      all += p;
      if (i * binHz >= 2500 && i * binHz < 3600) band += p;
    });
    return 10 * Math.log10(band / all);
  };
  it("orders the modes by ring like the recordings", () => {
    const n = ring("neutral", 3, "EH"),
      c = ring("curbing", 6, "I"),
      o = ring("overdrive", 8, "EH"),
      e = ring("edge", 8, "EH");
    expect(n).toBeLessThan(c);
    expect(o).toBeLessThan(e);
    expect(e - n).toBeGreaterThan(15);
  });
});
