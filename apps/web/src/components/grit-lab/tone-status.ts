import { soundOf, type Tone, type ToneOrigin } from "@voxilizer/engine";
import type { SavedTone } from "@/lib/validation/tones";

/** A library tone as a song tone: a copy of the sound, labelled with where it came from. */
export function toneFromLibrary(t: SavedTone): Tone {
  return { ...t.data.tone, origin: originOf(t) };
}

export const originOf = (t: SavedTone): ToneOrigin => ({ id: t.id, name: t.name, savedAt: t.savedAt });

export const sameSound = (a: Tone, b: Tone) => JSON.stringify(soundOf(a)) === JSON.stringify(soundOf(b));

export type ToneStatus =
  /** Not from the library. */
  | { kind: "custom" }
  /** Same as the library version. */
  | { kind: "library"; tone: SavedTone }
  /** Picked from the library, then adjusted in this song. */
  | { kind: "edited"; tone: SavedTone | null }
  /** The library version has been saved again since the song copied it. */
  | { kind: "outdated"; tone: SavedTone }
  /** Its library tone was deleted; the song keeps its copy. */
  | { kind: "deleted" };

/** How a song's copy of a tone relates to the library. */
export function toneStatus(tone: Tone, library: SavedTone[], libraryReady: boolean): ToneStatus {
  const o = tone.origin;
  if (!o) return { kind: "custom" };
  const lib = library.find((t) => t.id === o.id);
  if (!lib) return libraryReady ? { kind: "deleted" } : { kind: "edited", tone: null };
  if (lib.savedAt !== o.savedAt) return { kind: "outdated", tone: lib };
  return sameSound(tone, lib.data.tone) ? { kind: "library", tone: lib } : { kind: "edited", tone: lib };
}

/** Display name for a tone in a song. */
export function toneLabel(tone: Tone, library: SavedTone[], libraryReady: boolean): string {
  const s = toneStatus(tone, library, libraryReady);
  if (!tone.origin) return "Custom tone";
  const name = s.kind === "outdated" || s.kind === "library" ? s.tone.name : tone.origin.name;
  return s.kind === "edited" ? `${name} (adjusted)` : name;
}
