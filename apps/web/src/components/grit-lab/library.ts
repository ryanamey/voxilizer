"use client";

import { create } from "zustand";
import { deleteToneAction, listTonesAction, saveToneAction } from "@/app/dashboard/grit-lab/actions";
import type { SavedTone, SavedToneData } from "@/lib/validation/tones";

/** The signed-in singer's tone library, shared by Grit Lab and Melody Studio. */
interface LibraryState {
  tones: SavedTone[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  /** Load once per page visit (call again with force to refresh). */
  load: (force?: boolean) => Promise<void>;
  save: (name: string, data: SavedToneData, id?: string | null) => Promise<SavedTone | string>;
  remove: (id: string) => Promise<string | null>;
}

export const useToneLibrary = create<LibraryState>()((set, get) => ({
  tones: [],
  status: "idle",
  error: null,
  load: async (force = false) => {
    if (!force && (get().status === "loading" || get().status === "ready")) return;
    set({ status: "loading", error: null });
    const r = await listTonesAction().catch(() => null);
    if (r?.ok) set({ tones: r.data, status: "ready" });
    else set({ status: "error", error: r && !r.ok ? r.error : "Your tones couldn't be loaded." });
  },
  save: async (name, data, id) => {
    const r = await saveToneAction(name, data, id).catch(() => null);
    if (!r) return "Saving failed. Check your connection and try again.";
    if (!r.ok) return r.error;
    set({ tones: [r.data, ...get().tones.filter((t) => t.id !== r.data.id)] });
    return r.data;
  },
  remove: async (id) => {
    const r = await deleteToneAction(id).catch(() => null);
    if (!r) return "Deleting failed. Check your connection and try again.";
    if (!r.ok) return r.error;
    set({ tones: get().tones.filter((t) => t.id !== id) });
    return null;
  },
}));

export { originOf, sameSound, toneFromLibrary, toneLabel, toneStatus, type ToneStatus } from "./tone-status";
