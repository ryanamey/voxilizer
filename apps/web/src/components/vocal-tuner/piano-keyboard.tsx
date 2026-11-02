"use client";

import { memo } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Piano, PIANO_HIGH, PIANO_LOW, type KeyLook } from "@/components/piano/piano";

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

/** The singing-range piano: the target turns green, a wrong sung note red, with an arrow to the target. */
export const PianoKeyboard = memo(function PianoKeyboard({
  target,
  sung,
  onTarget,
  direction,
  hint,
  onSelect,
}: Props) {
  const wrong = sung !== null && !onTarget && sung !== target;
  // A note sung outside the keyboard (below C2, above C6) points from the nearest edge.
  const at = sung === null ? null : Math.min(PIANO_HIGH, Math.max(PIANO_LOW, sung));

  function look(m: number): KeyLook {
    if (m === target) {
      const className = onTarget
        ? "bg-stage-clean ring-4 ring-stage-clean/40 z-20"
        : sung === target
          ? "bg-stage-clean/70 ring-2 ring-stage-4 z-20"
          : "bg-stage-clean z-10";
      return { className, dark: true, pressed: true, state: "target", showName: true, description: "target" };
    }
    if (m === sung && wrong)
      return {
        className: "bg-stage-4 z-10",
        dark: true,
        state: "wrong",
        showName: true,
        description: "you're singing this",
      };
    return { pressed: false };
  }

  return (
    <Piano
      label="Piano keyboard, C2 to C6. Choose the note to sing."
      look={look}
      handlers={(m) => ({ onClick: () => onSelect(m) })}
      overlaySpace
      reveal={sung ?? target}
      overlay={(center) =>
        wrong && target !== null ? (
          <>
            {/* Path from the sung note to the target, and the arrow. */}
            <div
              className="absolute -top-3 h-1.5 rounded-full bg-stage-4/30"
              style={{
                left: `${Math.min(center(at!), center(target))}%`,
                width: `${Math.abs(center(at!) - center(target))}%`,
              }}
              aria-hidden
            />
            {direction !== 0 && (
              <div
                className="pointer-events-none absolute -top-11 z-30 flex -translate-x-1/2 items-center gap-1 rounded-md bg-stage-4 px-2 py-1 text-xs font-semibold whitespace-nowrap text-white shadow"
                style={{ left: `${center(at!)}%` }}
                aria-hidden
              >
                {direction < 0 && <ArrowLeftIcon className="size-4" />}
                {hint}
                {direction > 0 && <ArrowRightIcon className="size-4" />}
              </div>
            )}
          </>
        ) : null
      }
    />
  );
});
