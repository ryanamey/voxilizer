"use client";

import { memo, useEffect, useRef } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isBlack, KEY_MAX, KEY_MIN, keyName } from "./tuner";

const WHITE_W = 24;
const BLACK_W = 15;
const WHITE_H = 132;
const BLACK_H = 82;

/** Left edge of a key, in px, on a keyboard starting at KEY_MIN. */
function keyX(midi: number): number {
  let whites = 0;
  for (let m = KEY_MIN; m < midi; m++) if (!isBlack(m)) whites++;
  return isBlack(midi) ? whites * WHITE_W - BLACK_W / 2 : whites * WHITE_W;
}
const keyCenter = (midi: number) => keyX(midi) + (isBlack(midi) ? BLACK_W : WHITE_W) / 2;
const KEYS = Array.from({ length: KEY_MAX - KEY_MIN + 1 }, (_, i) => KEY_MIN + i);
const WIDTH = KEYS.filter((k) => !isBlack(k)).length * WHITE_W;

interface Props {
  target: number | null;
  /** The key being sung, if any. */
  sung: number | null;
  /** Sung key is the target and in tune. */
  onTarget: boolean;
  /** -1 = sing lower, 1 = sing higher, 0 = no arrow. */
  direction: -1 | 0 | 1;
  hint: string | null;
  onSelect: (midi: number) => void;
}

/** A 7-octave piano (C1–B7): the target turns green, a wrong sung note red, with an arrow to the target. */
export const PianoKeyboard = memo(function PianoKeyboard({
  target,
  sung,
  onTarget,
  direction,
  hint,
  onSelect,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the target (and the sung note, when it wanders) in view.
  useEffect(() => {
    const el = scroller.current;
    if (!el || target === null) return;
    const x = keyCenter(target);
    if (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - 40)
      el.scrollTo({ left: x - el.clientWidth / 2, behavior: "smooth" });
  }, [target]);
  useEffect(() => {
    const el = scroller.current;
    if (!el || sung === null) return;
    const x = keyCenter(sung);
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth)
      el.scrollTo({ left: x - el.clientWidth / 2, behavior: "smooth" });
  }, [sung]);

  const wrong = sung !== null && !onTarget && sung !== target;
  const band =
    wrong && target !== null
      ? {
          left: Math.min(keyCenter(sung), keyCenter(target)),
          right: Math.max(keyCenter(sung), keyCenter(target)),
        }
      : null;

  function keyClass(m: number, black: boolean) {
    if (m === target && (onTarget || sung === target))
      return onTarget
        ? "bg-stage-clean ring-4 ring-stage-clean/40 z-20"
        : "bg-stage-clean/70 ring-2 ring-stage-4 z-20";
    if (m === target) return "bg-stage-clean z-10";
    if (m === sung && wrong) return "bg-stage-4 z-10";
    // Real piano colours in both themes.
    return black ? "bg-neutral-900 hover:bg-neutral-700" : "bg-white hover:bg-neutral-100";
  }

  return (
    <div
      ref={scroller}
      className="overflow-x-auto rounded-xl border bg-muted/40 px-3 pt-12 pb-3"
      role="group"
      aria-label="Piano keyboard, C1 to B7. Choose the note to sing."
    >
      <div className="relative mx-auto" style={{ width: WIDTH, height: WHITE_H }}>
        {/* Path from the sung note to the target, and the arrow. */}
        {band && (
          <div
            className="absolute -top-3 h-1.5 rounded-full bg-stage-4/30"
            style={{ left: band.left, width: band.right - band.left }}
            aria-hidden
          />
        )}
        {wrong && direction !== 0 && (
          <div
            className="pointer-events-none absolute -top-11 z-30 flex -translate-x-1/2 items-center gap-1 rounded-md bg-stage-4 px-2 py-1 text-xs font-semibold whitespace-nowrap text-white shadow"
            style={{ left: keyCenter(sung!) }}
            aria-hidden
          >
            {direction < 0 && <ArrowLeftIcon className="size-4" />}
            {hint}
            {direction > 0 && <ArrowRightIcon className="size-4" />}
          </div>
        )}

        {KEYS.map((m) => {
          const black = isBlack(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => onSelect(m)}
              aria-label={keyName(m)}
              aria-pressed={m === target}
              data-key={m}
              data-state={m === target ? "target" : m === sung && wrong ? "wrong" : undefined}
              className={cn(
                "absolute top-0 flex items-end justify-center rounded-b-md border border-neutral-400/70 pb-1.5 text-[10px] font-medium transition-colors duration-75 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                black ? "z-10 text-white" : "text-neutral-500",
                keyClass(m, black),
                (m === target || (m === sung && wrong)) && "text-white",
              )}
              style={{
                left: keyX(m),
                width: black ? BLACK_W : WHITE_W,
                height: black ? BLACK_H : WHITE_H,
              }}
            >
              {!black && m % 12 === 0 ? keyName(m) : m === target || (m === sung && wrong) ? keyName(m) : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
});
