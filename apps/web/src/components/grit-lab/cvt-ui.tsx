"use client";

import { WrenchIcon } from "lucide-react";
import {
  DENSITIES,
  densityOf,
  MODE_DENSITIES,
  volumeRange,
  volumeRangeText,
  VOLUME_LABEL,
  VOLUME_MAX,
  VOLUME_MIN,
  VOWELS,
  VOWEL_IDS,
  type Check,
  type CheckFix,
  type CheckSeverity,
  type DensityId,
  type Tone,
} from "@voxilizer/engine";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LabeledSlider, Segmented } from "./controls";

export const VOWEL_OPTIONS = VOWEL_IDS.map((v) => ({ value: v, label: v, hint: VOWELS[v].word }));

export const SEVERITY_STYLE: Record<CheckSeverity, { label: string; dot: string; text: string }> = {
  avoid: { label: "Avoid", dot: "bg-stage-4", text: "text-stage-4" },
  caution: { label: "Caution", dot: "bg-stage-3", text: "text-stage-3" },
  tip: { label: "Tip", dot: "bg-primary", text: "text-primary" },
};

/** CVT density for the tone: the options its mode allows. Curbing is always reduced. */
export function DensityPicker({
  tone,
  size,
  disabled,
  onChange,
}: {
  tone: Pick<Tone, "mode" | "density">;
  size?: "sm" | "default";
  disabled?: boolean;
  onChange: (density: DensityId) => void;
}) {
  const allowed = MODE_DENSITIES[tone.mode];
  if (allowed.length === 1)
    return (
      <p className="text-xs text-muted-foreground">
        Density: Curbing is always sung in reduced density (held-in, medium volume).
      </p>
    );
  return (
    <Segmented
      label="Density"
      size={size}
      value={densityOf(tone)}
      disabled={disabled}
      options={allowed.map((d) => ({ value: d, label: DENSITIES[d].label, hint: DENSITIES[d].hint }))}
      onChange={onChange}
    />
  );
}

/** Volume on CVT's 1–10 scale, with the healthy range for the mode and density shown. */
export function VolumeSlider({
  id,
  tone,
  value,
  disabled,
  onChange,
  onCommit,
}: {
  id: string;
  tone: Pick<Tone, "mode" | "density">;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  const density = densityOf(tone);
  const [lo, hi] = volumeRange(tone.mode, density, tone.mode === "neutral" ? "high" : undefined);
  const inRange = value >= lo && value <= hi;
  return (
    <div className="flex flex-col gap-1">
      <LabeledSlider
        id={id}
        label="Volume"
        value={value}
        min={VOLUME_MIN}
        max={VOLUME_MAX}
        display={`${value} · ${VOLUME_LABEL[value]}`}
        ends={["1 · pp", "10 · ff"]}
        disabled={disabled}
        onChange={onChange}
        onCommit={onCommit}
      />
      <p className={cn("text-xs", inRange ? "text-muted-foreground" : "text-stage-3")}>
        {volumeRangeText(tone.mode, density)}
      </p>
    </div>
  );
}

/** CVT advice for a note or the designer's tone, each with an optional one-click fix. */
export function ChecksList({
  checks,
  onFix,
  empty = "In the centre of the mode: no CVT warnings.",
}: {
  checks: readonly Check[];
  onFix?: (fix: CheckFix) => void;
  empty?: string;
}) {
  if (!checks.length) return <p className="text-sm text-stage-clean">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {checks.map((c) => {
        const s = SEVERITY_STYLE[c.severity];
        return (
          <li key={c.rule} className="flex gap-3 rounded-lg border bg-background/60 p-3">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", s.dot)} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-sm font-medium">
                <span className={cn("mr-1.5 text-xs font-semibold uppercase", s.text)}>{s.label}</span>
                {c.title}
              </p>
              <p className="text-sm text-muted-foreground">{c.detail}</p>
              {c.fix && onFix && (
                <div>
                  <Button type="button" size="sm" variant="outline" onClick={() => onFix(c.fix!)}>
                    <WrenchIcon /> {c.fix.label}
                  </Button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
