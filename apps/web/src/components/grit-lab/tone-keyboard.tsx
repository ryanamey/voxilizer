"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  checkNote,
  PITCH_MAX,
  PITCH_MIN,
  worstSeverity,
  type Note,
  type Tone,
  type VoiceSettings,
} from "@voxilizer/engine";
import type { RenderedAudio } from "@/audio/audio-engine";
import { Piano, PIANO_HIGH, PIANO_LOW } from "@/components/piano/piano";
import { cn } from "@/lib/utils";
import { useAudio } from "@/audio/audio-context";
import { useGritLab } from "./store";

const KEYS = Array.from({ length: PIANO_HIGH - PIANO_LOW + 1 }, (_, i) => PIANO_LOW + i);
/** How long each key sustains when held. */
const NOTE_SECONDS = 3;
/** Keys rendered ahead of time, around the preview note; the rest render on first press. */
const WARM_RANGE = 12;
const CACHE_LIMIT = 40;

/** Computer keys, one octave and a bit: A W S E D F T G Y H U J K O L P ; */
const COMPUTER_KEYS = ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j", "k", "o", "l", "p", ";"];

const signature = (tone: Tone, voice: VoiceSettings, vowel: Note["vowel"]) =>
  JSON.stringify([tone, voice, vowel]);

/**
 * A playable keyboard: every key sings the tone designed above, at that pitch, on the preview vowel.
 * Notes are rendered in the background as the design changes, so pressing a key is instant.
 */
export function ToneKeyboard() {
  const { engine, play, release } = useAudio();
  const tone = useGritLab((s) => s.tone);
  const singer = useGritLab((s) => s.singer);
  const voice = useMemo(() => ({ singer }), [singer]);
  const vowel = useGritLab((s) => s.preview.vowel);
  const previewPitch = useGritLab((s) => s.preview.pitch);
  const { setPreview } = useGritLab.getState();

  const [down, setDown] = useState<number | null>(null);
  const [octave, setOctave] = useState(() => Math.floor(previewPitch / 12) * 12);
  const pointerDown = useRef(false);
  const cache = useRef(new Map<number, Promise<RenderedAudio>>());
  const sig = signature(tone, voice, vowel);
  const pressId = useRef(0);

  const renderKey = useCallback(
    (pitch: number): Promise<RenderedAudio> => {
      const hit = cache.current.get(pitch);
      if (hit) return hit;
      const s = useGritLab.getState();
      const p = engine.renderNote(pitch, s.preview.vowel, s.tone, { singer: s.singer }, NOTE_SECONDS);
      p.catch(() => cache.current.delete(pitch));
      cache.current.set(pitch, p);
      // Forget the oldest renders so memory stays bounded.
      while (cache.current.size > CACHE_LIMIT) cache.current.delete(cache.current.keys().next().value!);
      return p;
    },
    [engine],
  );

  // A new design invalidates every rendered key; warm up the keys nearest the preview note.
  useEffect(() => {
    cache.current.clear();
    let cancelled = false;
    const center = useGritLab.getState().preview.pitch;
    const order = KEYS.filter((k) => Math.abs(k - center) <= WARM_RANGE).sort(
      (a, b) => Math.abs(a - center) - Math.abs(b - center),
    );
    const t = setTimeout(async () => {
      for (const k of order) {
        if (cancelled) return;
        await renderKey(k).catch(() => undefined);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [sig, renderKey]);

  const noteOn = useCallback(
    async (pitch: number) => {
      const id = ++pressId.current;
      setDown(pitch);
      try {
        const audio = await renderKey(pitch);
        // Only play if this is still the latest press (fast glides skip notes that weren't ready).
        if (id === pressId.current) await play(audio, "key");
      } catch {
        /* a failed render just stays silent */
      }
      // Move the designer's preview note here too (scopes, CVT check), after the sound has started:
      // re-rendering the designer first would delay the note.
      if (id === pressId.current) startTransition(() => setPreview({ pitch }));
    },
    [play, renderKey, setPreview],
  );

  const noteOff = useCallback(() => {
    pressId.current++;
    setDown(null);
    release();
  }, [release]);

  // Computer keyboard: A–; play, Z/X shift the octave.
  useEffect(() => {
    const held = new Set<string>();
    const typing = (e: KeyboardEvent) =>
      e.metaKey ||
      e.ctrlKey ||
      e.altKey ||
      !!(e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable=true]");
    const onDown = (e: KeyboardEvent) => {
      if (typing(e) || e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === "z" || k === "x") {
        setOctave((o) => Math.max(PITCH_MIN, Math.min(PITCH_MAX - 12, o + (k === "z" ? -12 : 12))));
        return;
      }
      const i = COMPUTER_KEYS.indexOf(k);
      if (i < 0) return;
      const pitch = octave + i;
      if (pitch < PITCH_MIN || pitch > PITCH_MAX) return;
      held.add(k);
      void noteOn(pitch);
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!held.delete(k)) return;
      if (held.size === 0) noteOff();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [octave, noteOn, noteOff]);

  // CVT check for every key: where this tone sits outside its mode's healthy range.
  const flags = useMemo(() => {
    const out = new Map<number, "avoid" | "caution">();
    for (const k of KEYS) {
      const w = worstSeverity(checkNote({ pitch: k, vowel }, tone, voice));
      if (w === "avoid" || w === "caution") out.set(k, w);
    }
    return out;
  }, [tone, voice, vowel]);

  return (
    <section aria-labelledby="keyboard-heading" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="keyboard-heading" className="text-xl font-bold tracking-tight">
          Play your tone
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every key sings the tone you designed above, so you can hear it across your whole range.
        </p>
      </div>
      <Piano
        label="Keyboard: each key plays your designed tone at that pitch"
        reveal={down ?? octave}
        frame={{
          onPointerUp: () => {
            if (pointerDown.current) {
              pointerDown.current = false;
              noteOff();
            }
          },
          onPointerLeave: () => {
            if (pointerDown.current) {
              pointerDown.current = false;
              noteOff();
            }
          },
        }}
        look={(m) => {
          const flag = flags.get(m);
          return {
            pressed: down === m,
            description: flag ? `${flag} for this tone` : undefined,
            ...(down === m && { className: "bg-primary text-primary-foreground hover:bg-primary" }),
          };
        }}
        content={(m) => {
          const flag = flags.get(m);
          const comp = m - octave;
          const letter = comp >= 0 && comp < COMPUTER_KEYS.length ? COMPUTER_KEYS[comp]!.toUpperCase() : null;
          return (
            <>
              {flag && (
                <span
                  className={cn("size-2 rounded-full", flag === "avoid" ? "bg-stage-4" : "bg-stage-3")}
                  aria-hidden
                />
              )}
              {letter && <span className="opacity-60">{letter}</span>}
            </>
          );
        }}
        handlers={(m) => ({
          onPointerDown: (e) => {
            e.preventDefault();
            // Touch captures the pointer on the first key; release it so dragging reaches the others.
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
            pointerDown.current = true;
            void noteOn(m);
          },
          onPointerEnter: () => {
            // Glide: drag across the keys with the button held.
            if (pointerDown.current && down !== m) void noteOn(m);
          },
          onKeyDown: (e) => {
            if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
              e.preventDefault();
              e.stopPropagation();
              void noteOn(m);
            }
          },
          onKeyUp: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              noteOff();
            }
          },
        })}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Click, hold or drag across the keys, or play with your computer keys (A to ;). Z and X change
          octave. Each key sings your tone on the vowel {vowel}.
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-stage-4" /> avoid this tone and vowel on that note
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-stage-3" /> caution (press the key to see why in the CVT
          check)
        </span>
      </div>
    </section>
  );
}
