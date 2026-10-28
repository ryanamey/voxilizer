"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/** Section of the tone panel with a heading and a short hint. */
export function ControlGroup({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4 border-t pt-4 first:border-t-0 first:pt-0", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

interface LabeledSliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  ends?: [string, string];
  disabled?: boolean;
  onChange: (v: number) => void;
  /** Fires when the user lets go (used to auto-play). */
  onCommit?: (v: number) => void;
}

export function LabeledSlider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  display,
  ends,
  disabled,
  onChange,
  onCommit,
}: LabeledSliderProps) {
  return (
    <div className={cn("flex flex-col gap-2", disabled && "opacity-50")}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} id={`${id}-label`} className="text-xs font-semibold tracking-wide uppercase">
          {label}
        </Label>
        <output htmlFor={id} className="font-mono text-xs text-primary tabular-nums">
          {display}
        </output>
      </div>
      <Slider
        id={id}
        aria-labelledby={`${id}-label`}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(v) => onChange(v[0] ?? value)}
        onValueCommit={(v) => onCommit?.(v[0] ?? value)}
      />
      {ends && (
        <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </div>
      )}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T | null;
  options: { value: T; label: string; hint?: string }[];
  disabled?: boolean;
  onChange: (v: T) => void;
  size?: "sm" | "default";
}

/** Single-choice button group (radio semantics). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
  size = "default",
}: SegmentedProps<T>) {
  return (
    <div className={cn("flex flex-col gap-2", disabled && "opacity-50")}>
      <span className="text-xs font-semibold tracking-wide uppercase">{label}</span>
      <ToggleGroup
        type="single"
        variant="outline"
        size={size === "sm" ? "sm" : "default"}
        value={value ?? ""}
        disabled={disabled}
        onValueChange={(v) => v && onChange(v as T)}
        aria-label={label}
        className="flex-wrap justify-start"
      >
        {options.map((o) => (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            aria-label={o.hint ? `${o.label} (${o.hint})` : o.label}
            className="h-auto min-w-11 flex-col gap-0 px-3 py-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <span className="text-sm leading-tight">{o.label}</span>
            {o.hint && <span className="font-mono text-[10px] leading-tight opacity-70">{o.hint}</span>}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
