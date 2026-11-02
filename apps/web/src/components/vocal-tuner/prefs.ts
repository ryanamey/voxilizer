"use client";

import { useSyncExternalStore } from "react";
import { TIMBRES, type TimbreId } from "./timbres";

/** The tuner's sound choices, remembered per browser (kept in memory if storage is blocked). */
export interface SoundPrefs {
  timbre: TimbreId;
  singer: "female" | "male";
  /** Hold the reference note so the singer can sing along (needs headphones). */
  sustain: boolean;
}

const KEY = "voxilizer.tuner.sound";
const DEFAULTS: SoundPrefs = { timbre: "clean", singer: "male", sustain: false };
const listeners = new Set<() => void>();
let memory: SoundPrefs | null = null;
let cachedRaw: string | null | undefined;
let cached: SoundPrefs = DEFAULTS;

function read(): SoundPrefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return memory ?? DEFAULTS;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const p = JSON.parse(raw ?? "{}") as Partial<Record<keyof SoundPrefs, unknown>>;
    cached = {
      timbre: typeof p.timbre === "string" && p.timbre in TIMBRES ? (p.timbre as TimbreId) : DEFAULTS.timbre,
      singer: p.singer === "female" ? "female" : "male",
      sustain: p.sustain === true,
    };
  } catch {
    cached = DEFAULTS;
  }
  return cached;
}

export function saveSoundPrefs(patch: Partial<SoundPrefs>) {
  const next = { ...read(), ...patch };
  memory = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode: remembered for this visit only */
  }
  listeners.forEach((l) => l());
}

export function useSoundPrefs(): SoundPrefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => DEFAULTS,
  );
}
