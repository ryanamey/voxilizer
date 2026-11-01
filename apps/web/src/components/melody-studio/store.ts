"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import {
  DEFAULT_TONE,
  DEFAULT_VOICE,
  exampleSong,
  patchTone,
  type CheckFix,
  type Note,
  type SingerId,
  type Song,
  type Tone,
  type VowelId,
} from "@voxilizer/engine";
import { fitToBars, resolveOverlaps } from "./notes";

export interface MelodyState {
  /** The song being edited. Only this is tracked by undo/redo. */
  song: Song;
  /** Database id once saved. */
  songId: string | null;
  /** JSON of the song as last saved, to detect unsaved changes. */
  savedJson: string;
  selection: string[];
  newVowel: VowelId;
  /** Length of new notes, in grid steps. */
  newLength: number;

  setTitle: (title: string) => void;
  setTempo: (tempo: number) => void;
  setBars: (bars: number) => void;
  setSinger: (singer: SingerId) => void;
  setNewVowel: (v: VowelId) => void;
  setNewLength: (steps: number) => void;
  /** Replace the song tone (picked from the library or sent from Grit Lab). */
  setSongTone: (tone: Tone) => void;

  /** Replace all notes in one undoable step (used when a drag finishes). */
  commitNotes: (notes: Note[], selection?: string[]) => void;
  addNote: (note: Note) => void;
  deleteSelected: () => void;
  setSelection: (ids: string[]) => void;
  setSelectedVowel: (v: VowelId) => void;
  /** Give the selected notes (or the notes with these ids) a tone; null = follow the song tone. */
  setNotesTone: (tone: Tone | null, ids?: string[]) => void;
  /** Adjust the selected notes' tones (creates per-note tones from the song tone where needed). */
  adjustSelectedTone: (patch: Partial<Tone>) => void;
  /** Apply a CVT check's suggested fix to one note (creates a per-note tone if needed). */
  applyNoteFix: (noteId: string, fix: CheckFix) => void;
  /** Replace every copy of a library tone (song tone and notes) with its new version. */
  updateFromLibrary: (originId: string, tone: Tone) => void;
  /** Keep this song's copies of a library tone as they are, acknowledging a newer library version. */
  keepVersion: (originId: string, savedAt: string) => void;

  loadSong: (song: Song, id: string | null) => void;
  newSong: () => void;
  markSaved: (id: string) => void;
}

export function blankSong(): Song {
  return {
    version: 3,
    title: "Untitled song",
    tempo: 92,
    bars: 4,
    tone: { ...DEFAULT_TONE },
    voice: { ...DEFAULT_VOICE },
    notes: [],
  };
}

export const useMelody = create<MelodyState>()(
  temporal(
    (set, get) => {
      const mapSong = (fn: (s: Song) => Song) => set({ song: fn(get().song) });
      const selectedSet = () => new Set(get().selection);

      return {
        song: exampleSong(),
        songId: null,
        savedJson: "",
        selection: [],
        newVowel: "AH",
        newLength: 2,

        setTitle: (title) => mapSong((s) => ({ ...s, title })),
        setTempo: (tempo) => mapSong((s) => ({ ...s, tempo })),
        setBars: (bars) => mapSong((s) => ({ ...s, bars, notes: fitToBars(s.notes, bars) })),
        setSinger: (singer) => mapSong((s) => ({ ...s, voice: { ...s.voice, singer } })),
        setNewVowel: (newVowel) => set({ newVowel }),
        setNewLength: (newLength) => set({ newLength }),
        setSongTone: (tone) => mapSong((s) => ({ ...s, tone })),

        commitNotes: (notes, selection) => {
          const sel = new Set(selection ?? get().selection);
          set({ song: { ...get().song, notes: resolveOverlaps(notes, sel) }, selection: [...sel] });
        },
        addNote: (note) => {
          const sel = new Set([note.id]);
          set({
            song: { ...get().song, notes: resolveOverlaps([...get().song.notes, note], sel) },
            selection: [note.id],
          });
        },
        deleteSelected: () => {
          const sel = selectedSet();
          if (!sel.size) return;
          set({
            song: { ...get().song, notes: get().song.notes.filter((n) => !sel.has(n.id)) },
            selection: [],
          });
        },
        setSelection: (selection) => set({ selection }),
        setSelectedVowel: (v) => {
          const sel = selectedSet();
          mapSong((s) => ({ ...s, notes: s.notes.map((n) => (sel.has(n.id) ? { ...n, vowel: v } : n)) }));
        },
        setNotesTone: (tone, ids) => {
          const sel = new Set(ids ?? get().selection);
          mapSong((s) => ({ ...s, notes: s.notes.map((n) => (sel.has(n.id) ? { ...n, tone } : n)) }));
        },
        adjustSelectedTone: (patch) => {
          const sel = selectedSet();
          mapSong((s) => ({
            ...s,
            notes: s.notes.map((n) =>
              sel.has(n.id) ? { ...n, tone: patchTone(n.tone ?? s.tone, patch) } : n,
            ),
          }));
        },
        applyNoteFix: (noteId, fix) =>
          mapSong((s) => ({
            ...s,
            notes: s.notes.map((n) =>
              n.id !== noteId
                ? n
                : {
                    ...n,
                    vowel: fix.vowel ?? n.vowel,
                    tone: fix.tone ? patchTone(n.tone ?? s.tone, fix.tone) : n.tone,
                  },
            ),
          })),
        updateFromLibrary: (originId, tone) =>
          mapSong((s) => ({
            ...s,
            tone: s.tone.origin?.id === originId ? tone : s.tone,
            notes: s.notes.map((n) => (n.tone?.origin?.id === originId ? { ...n, tone } : n)),
          })),
        keepVersion: (originId, savedAt) => {
          const keep = (t: Tone | null) =>
            t?.origin?.id === originId ? { ...t, origin: { ...t.origin, savedAt } } : t;
          mapSong((s) => ({
            ...s,
            tone: keep(s.tone)!,
            notes: s.notes.map((n) => ({ ...n, tone: keep(n.tone) })),
          }));
        },

        loadSong: (song, id) => {
          set({ song, songId: id, savedJson: id ? JSON.stringify(song) : "", selection: [] });
          useMelody.temporal.getState().clear();
        },
        newSong: () => {
          set({ song: blankSong(), songId: null, savedJson: "", selection: [] });
          useMelody.temporal.getState().clear();
        },
        markSaved: (id) => set({ songId: id, savedJson: JSON.stringify(get().song) }),
      };
    },
    {
      // Only the song is undoable; selection and editor settings are not.
      partialize: (s) => ({ song: s.song }),
      equality: (a, b) => a.song === b.song,
      limit: 100,
      handleSet: (handleSet) => {
        let last = 0;
        return (...args: Parameters<typeof handleSet>) => {
          const now = Date.now();
          if (now - last > 400) handleSet(...args);
          last = now;
        };
      },
    },
  ),
);

/** True when the song differs from what was last saved (or was never saved). */
export function useIsDirty(): boolean {
  return useMelody((s) => (s.songId ? JSON.stringify(s.song) !== s.savedJson : s.song.notes.length > 0));
}
