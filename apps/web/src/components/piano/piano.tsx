"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { isBlack, keyName, PIANO_HIGH, PIANO_LOW } from "./keys";

export { isBlack, keyName, PIANO_HIGH, PIANO_LOW };

/** Black keys are this fraction of a white key's width. */
const BLACK_RATIO = 0.62;
/** Below this width per white key, the keyboard scrolls sideways instead of shrinking. */
const MIN_WHITE_PX = 22;

/** Key positions as percentages of the keyboard's width, so it can fill any container. */
export function pianoGeometry(low = PIANO_LOW, high = PIANO_HIGH) {
  const keys = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  const whiteCount = keys.filter((k) => !isBlack(k)).length;
  const whiteW = 100 / whiteCount;
  const blackW = whiteW * BLACK_RATIO;
  const whitesBefore = (m: number) => {
    let n = 0;
    for (let k = low; k < m; k++) if (!isBlack(k)) n++;
    return n;
  };
  const left = (m: number) => (isBlack(m) ? whitesBefore(m) * whiteW - blackW / 2 : whitesBefore(m) * whiteW);
  const width = (m: number) => (isBlack(m) ? blackW : whiteW);
  const center = (m: number) => left(m) + width(m) / 2;
  return { keys, whiteCount, left, width, center, minWidthPx: whiteCount * MIN_WHITE_PX };
}

export interface KeyLook {
  /** Colour classes for this key; the default is real piano colours in both themes. */
  className?: string;
  /** Text colour should be light on this key's background. */
  dark?: boolean;
  pressed?: boolean;
  /** Extra words for screen readers, after the note name. */
  description?: string;
  /** For tests: e.g. "target", "wrong". */
  state?: string;
  /** Show the note name on this key (C keys always show it). */
  showName?: boolean;
}

interface PianoProps {
  label: string;
  low?: number;
  high?: number;
  height?: number;
  look?: (midi: number) => KeyLook;
  /** Extra content stacked above the note name at the bottom of a key (dots, letters). */
  content?: (midi: number) => ReactNode;
  handlers?: (midi: number) => ButtonHTMLAttributes<HTMLButtonElement>;
  /** Drawn above the keys; `center(m)` gives a key's centre in % of the width. */
  overlay?: (center: (midi: number) => number) => ReactNode;
  /** Leave room above the keys for the overlay. */
  overlaySpace?: boolean;
  /** Scroll so this key is visible (on narrow screens where the keyboard scrolls). */
  reveal?: number | null;
  frame?: HTMLAttributes<HTMLDivElement>;
}

/** The app's piano keyboard: C2–C6 by default, filling its container's width. */
export function Piano({
  label,
  low = PIANO_LOW,
  high = PIANO_HIGH,
  height = 150,
  look,
  content,
  handlers,
  overlay,
  overlaySpace = false,
  reveal = null,
  frame,
}: PianoProps) {
  const g = useMemo(() => pianoGeometry(low, high), [low, high]);
  const scroller = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    const box = inner.current;
    if (!el || !box || reveal === null || el.scrollWidth <= el.clientWidth) return;
    const x = (g.center(reveal) / 100) * box.clientWidth;
    if (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - 40)
      el.scrollTo({ left: x - el.clientWidth / 2, behavior: "smooth" });
  }, [reveal, g]);

  return (
    <div
      ref={scroller}
      {...frame}
      className={cn(
        "overflow-x-auto rounded-xl border bg-muted/40 px-3 pb-3 select-none",
        overlaySpace ? "pt-12" : "pt-3",
        frame?.className,
      )}
    >
      <div
        ref={inner}
        className="relative touch-none"
        style={{ minWidth: g.minWidthPx, height }}
        role="group"
        aria-label={label}
      >
        {overlay?.(g.center)}
        {g.keys.map((m) => {
          const black = isBlack(m);
          const l = look?.(m) ?? {};
          const name = keyName(m);
          return (
            <button
              key={m}
              type="button"
              aria-label={l.description ? `${name}, ${l.description}` : name}
              aria-pressed={l.pressed}
              data-key={m}
              data-state={l.state}
              {...handlers?.(m)}
              className={cn(
                "absolute top-0 flex flex-col items-center justify-end gap-1 rounded-b-md border border-neutral-400/70 pb-1.5 text-[10px] font-medium transition-colors duration-75 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                l.className ??
                  (black
                    ? "bg-neutral-900 text-neutral-300 hover:bg-neutral-700"
                    : "bg-white text-neutral-500 hover:bg-neutral-100"),
                l.dark && "text-white",
                // Black keys always sit above white keys, whatever colour a white key gets.
                black ? "z-20" : "z-0",
              )}
              style={{
                left: `${g.left(m)}%`,
                width: `${g.width(m)}%`,
                height: black ? height * 0.62 : height,
              }}
            >
              {content?.(m)}
              {((!black && m % 12 === 0) || l.showName) && <span className="truncate">{name}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
