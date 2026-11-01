"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChevronDownIcon, LibraryIcon, SlidersHorizontalIcon } from "lucide-react";
import { DENSITIES, densityOf, EFFECTS, MODES, soundOf, type Tone } from "@voxilizer/engine";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toneFromLibrary, useToneLibrary } from "@/components/grit-lab/library";
import { useGritLab } from "@/components/grit-lab/store";

/** One line describing a tone's sound, e.g. "Edge · fuller · vol 8 · growl 40% · distortion 30%". */
export function toneSummary(tone: Tone): string {
  const parts = [MODES[tone.mode].label];
  if (tone.mode !== "curbing") parts.push(DENSITIES[densityOf(tone)].label.toLowerCase());
  parts.push(`vol ${tone.volume}`);
  if (tone.effect !== "none" && tone.amount > 0)
    parts.push(`${EFFECTS[tone.effect].label.toLowerCase()} ${tone.amount}%`);
  if (tone.ff > 0) parts.push(`distortion ${tone.ff}%`);
  return parts.join(" · ");
}

/** The tone currently open in Grit Lab, as a song tone. */
export function currentDesign(): Tone {
  const s = useGritLab.getState();
  return { ...soundOf(s.tone), ...(s.loaded ? { origin: s.loaded } : {}) };
}

/** Choose a tone: one from the library, the design open in Grit Lab, or (for notes) the song tone. */
export function TonePicker({
  label,
  onPick,
  allowFollow = false,
  size = "sm",
}: {
  label: string;
  onPick: (tone: Tone | null) => void;
  allowFollow?: boolean;
  size?: "sm" | "default";
}) {
  const { tones, status, error, load } = useToneLibrary();
  const designName = useGritLab((s) => s.loaded?.name ?? null);
  useEffect(() => void load(), [load]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size={size}>
          {label} <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 w-72 overflow-y-auto">
        {allowFollow && (
          <>
            <DropdownMenuItem onSelect={() => onPick(null)}>Follow the song tone</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="flex items-center gap-2">
          <LibraryIcon className="size-4" /> My tones
        </DropdownMenuLabel>
        {status === "loading" || status === "idle" ? (
          <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
        ) : status === "error" ? (
          <DropdownMenuItem disabled>{error}</DropdownMenuItem>
        ) : tones.length === 0 ? (
          <DropdownMenuItem disabled>No saved tones yet. Save one in Grit Lab.</DropdownMenuItem>
        ) : (
          tones.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onSelect={() => onPick(toneFromLibrary(t))}
              className="flex flex-col items-start gap-0"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-xs text-muted-foreground">{toneSummary(t.data.tone)}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onPick(currentDesign())}
          className="flex flex-col items-start gap-0"
        >
          <span className="flex items-center gap-2 font-medium">
            <SlidersHorizontalIcon className="size-4" /> The tone open in Grit Lab
          </span>
          <span className="text-xs text-muted-foreground">
            {designName ?? "Unsaved design"} · {toneSummary(useGritLab.getState().tone)}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/grit-lab">Design a new tone in Grit Lab</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
