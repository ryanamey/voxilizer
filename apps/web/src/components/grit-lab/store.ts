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
  type Song,
  type Tone,
  type VoiceSettings,
  type VowelId,
} from "@voxilizer/engine";
import { fitToBars, resolveOverlaps } from "./notes";

export type Source = "synth" | "mine";
export type Pattern = "sustain" | "phrase";

export interface Preview {
  /** MIDI pitch of the designer's preview note. */
  pitch: number;
  vowel: VowelId;
  pattern: Pattern;
}

export interface GritLabState {
  /** The song being edited. Only this is tracked by undo/redo. */
  song: Song;
  /** Database id once saved. */
  songId: string | null;
  /** JSON of the song as last saved, to detect unsaved changes. */
  savedJson: string;
  selection: string[];
  preview: Preview;
  source: Source;
  newVowel: VowelId;
  /** Length of new notes, in grid steps. */
  newLength: number;

  setTone: (patch: Partial<Tone>) => void;
  setVoice: (patch: Partial<VoiceSettings>) => void;
  setTitle: (title: string) => void;
  setTempo: (tempo: number) => void;
  setBars: (bars: number) => void;
  setPreview: (patch: Partial<Preview>) => void;
  setSource: (source: Source) => void;
  setNewVowel: (v: VowelId) => void;
  setNewLength: (steps: number) => void;

  /** Replace all notes in one undoable step (used when a drag finishes). */
  commitNotes: (notes: Note[], selection?: string[]) => void;
  addNote: (note: Note) => void;
  deleteSelected: () => void;
  setSelection: (ids: string[]) => void;
  setSelectedVowel: (v: VowelId) => void;
  /** null = follow the song tone; otherwise override (merged with the current tone). */
  setSelectedTone: (patch: Partial<Tone> | null) => void;
  /** Apply a CVT check's suggested fix to one note (creates a per-note override if needed). */
  applyNoteFix: (noteId: string, fix: CheckFix) => void;

  loadSong: (song: Song, id: string | null) => void;
  newSong: () => void;
  markSaved: (id: string) => void;
}

export function blankSong(): Song {
  return {
    version: 2,
    title: "Untitled song",
    tempo: 92,
    bars: 4,
    tone: { ...DEFAULT_TONE },
    voice: { ...DEFAULT_VOICE },
    notes: [],
  };
}

const initialSong = exampleSong();

export const useGritLab = create<GritLabState>()(
  temporal(
    (set, get) => {
      const mapSong = (fn: (s: Song) => Song) => set({ song: fn(get().song) });
      const selectedSet = () => new Set(get().selection);

      return {
        song: initialSong,
        songId: null,
        savedJson: "",
        selection: [],
        preview: { pitch: 52, vowel: "AH", pattern: "sustain" },
        source: "synth",
        newVowel: "AH",
        newLength: 2,

        setTone: (patch) => mapSong((s) => ({ ...s, tone: patchTone(s.tone, patch) })),
        setVoice: (patch) => mapSong((s) => ({ ...s, voice: { ...s.voice, ...patch } })),
        setTitle: (title) => mapSong((s) => ({ ...s, title })),
        setTempo: (tempo) => mapSong((s) => ({ ...s, tempo })),
        setBars: (bars) => mapSong((s) => ({ ...s, bars, notes: fitToBars(s.notes, bars) })),
        setPreview: (patch) => set({ preview: { ...get().preview, ...patch } }),
        setSource: (source) => set({ source }),
        setNewVowel: (newVowel) => set({ newVowel }),
        setNewLength: (newLength) => set({ newLength }),

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
        setSelectedTone: (patch) => {
          const sel = selectedSet();
          mapSong((s) => ({
            ...s,
            notes: s.notes.map((n) =>
              sel.has(n.id) ? { ...n, tone: patch === null ? null : patchTone(n.tone ?? s.tone, patch) } : n,
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

        loadSong: (song, id) => {
          set({ song, songId: id, savedJson: id ? JSON.stringify(song) : "", selection: [] });
          useGritLab.temporal.getState().clear();
        },
        newSong: () => {
          set({ song: blankSong(), songId: null, savedJson: "", selection: [] });
          useGritLab.temporal.getState().clear();
        },
        markSaved: (id) => set({ songId: id, savedJson: JSON.stringify(get().song) }),
      };
    },
    {
      // Only the song is undoable; selection and preview settings are not.
      partialize: (s) => ({ song: s.song }),
      equality: (a, b) => a.song === b.song,
      limit: 100,
      // Record at most one undo step per burst (e.g. dragging a slider), keeping the state from before it.
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
  return useGritLab((s) => (s.songId ? JSON.stringify(s.song) !== s.savedJson : s.song.notes.length > 0));
}
