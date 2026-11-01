import { describe, expect, it } from "vitest";
import { DEFAULT_TONE, type Tone } from "@voxilizer/engine";
import type { SavedTone } from "@/lib/validation/tones";
import { toneFromLibrary, toneLabel, toneStatus } from "../tone-status";

const lib = (savedAt: string, tone: Partial<Tone> = {}): SavedTone => ({
  id: "a",
  name: "My rock grit",
  savedAt,
  data: {
    version: 1,
    tone: { ...DEFAULT_TONE, ...tone },
    singer: "male",
    preview: { vowel: "AH", pitch: 52 },
  },
});

describe("song copies of library tones", () => {
  const v1 = lib("2026-11-01T10:00:00.000Z");
  const copy = toneFromLibrary(v1);

  it("matches the library version it was copied from", () => {
    expect(toneStatus(copy, [v1], true).kind).toBe("library");
    expect(toneLabel(copy, [v1], true)).toBe("My rock grit");
  });

  it("shows when the song adjusted its copy", () => {
    const adjusted = { ...copy, volume: 3 };
    expect(toneStatus(adjusted, [v1], true).kind).toBe("edited");
    expect(toneLabel(adjusted, [v1], true)).toBe("My rock grit (adjusted)");
  });

  it("notices a newer library version, and a deleted one", () => {
    const v2 = lib("2026-11-01T12:00:00.000Z", { amount: 70 });
    expect(toneStatus(copy, [v2], true).kind).toBe("outdated");
    expect(toneStatus(copy, [], true).kind).toBe("deleted");
    expect(toneStatus({ ...DEFAULT_TONE }, [v1], true).kind).toBe("custom");
  });

  it("treats a missing larynx or twang as the default", () => {
    const { larynx: _l, twang: _t, ...bare } = copy;
    void _l;
    void _t;
    expect(toneStatus(bare as Tone, [v1], true).kind).toBe("library");
  });
});
