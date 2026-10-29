import { describe, expect, it } from "vitest";
import type { Note } from "@voxilizer/engine";
import { clampMove, fitToBars, resolveOverlaps } from "../notes";

const n = (id: string, pitch: number, start: number, length: number): Note => ({
  id,
  pitch,
  start,
  length,
  vowel: "A",
  tone: null,
});

describe("resolveOverlaps", () => {
  it("trims an unselected note that the selected note overlaps from the right", () => {
    const out = resolveOverlaps([n("a", 60, 0, 8), n("b", 60, 4, 2)], new Set(["b"]));
    expect(out.find((x) => x.id === "a")).toMatchObject({ start: 0, length: 4 });
  });

  it("cuts the front of a note the selected note overlaps from the left", () => {
    const out = resolveOverlaps([n("a", 60, 2, 6), n("b", 60, 0, 4)], new Set(["b"]));
    expect(out.find((x) => x.id === "a")).toMatchObject({ start: 4, length: 4 });
  });

  it("removes a note that is fully covered", () => {
    const out = resolveOverlaps([n("a", 60, 2, 2), n("b", 60, 0, 8)], new Set(["b"]));
    expect(out.map((x) => x.id)).toEqual(["b"]);
  });

  it("leaves notes on other pitches alone and does not mutate the input", () => {
    const input = [n("a", 62, 0, 8), n("b", 60, 0, 8)];
    const out = resolveOverlaps(input, new Set(["b"]));
    expect(out).toHaveLength(2);
    expect(input[0]).toMatchObject({ start: 0, length: 8 });
  });
});

describe("clampMove", () => {
  it("keeps a group inside the grid", () => {
    expect(clampMove([n("a", 60, 2, 4)], -5, 0, 64)).toEqual({ dStep: -2, dPitch: 0 });
    expect(clampMove([n("a", 60, 58, 4)], 5, 0, 64)).toEqual({ dStep: 2, dPitch: 0 });
    expect(clampMove([n("a", 83, 0, 4)], 0, 3, 64)).toEqual({ dStep: 0, dPitch: 1 });
  });
});

describe("fitToBars", () => {
  it("drops notes past the end and trims notes that cross it", () => {
    const out = fitToBars([n("a", 60, 10, 4), n("b", 60, 14, 6), n("c", 60, 20, 2)], 1);
    expect(out.map((x) => [x.id, x.length])).toEqual([
      ["a", 4],
      ["b", 2],
    ]);
  });
});
