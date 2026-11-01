"use client";

import { useEffect, useRef, type RefObject } from "react";
import { cssVar, fitCanvas } from "@/components/grit-lab/scopes";
import { keyName } from "./tuner";

export interface TrailPoint {
  t: number;
  midi: number | null;
  inTune: boolean;
}

const SECONDS = 6;
const RANGE = 7; // semitones shown above and below the target
const HEIGHT = 180;

/** The last few seconds of sung pitch against the target line. */
export function PitchTrail({
  points,
  target,
  toleranceCents,
}: {
  points: RefObject<TrailPoint[]>;
  target: number | null;
  toleranceCents: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let raf = 0;
    const draw = () => {
      const { g, w, h } = fitCanvas(canvas, HEIGHT);
      const fg = cssVar(canvas, "--muted-foreground");
      const good = cssVar(canvas, "--stage-clean");
      const bad = cssVar(canvas, "--stage-4");
      g.clearRect(0, 0, w, h);
      if (target === null) {
        g.fillStyle = fg;
        g.font = "13px sans-serif";
        g.textAlign = "center";
        g.fillText("Choose a note on the piano", w / 2, h / 2);
        raf = requestAnimationFrame(draw);
        return;
      }
      const pad = 40;
      const y = (m: number) => h / 2 - ((m - target) / RANGE) * (h / 2 - 8);
      // Semitone grid and tolerance band.
      g.font = "10px sans-serif";
      g.textAlign = "right";
      for (let s = -RANGE + 1; s < RANGE; s++) {
        g.strokeStyle = fg;
        g.globalAlpha = s % 12 === 0 ? 0 : 0.12;
        g.beginPath();
        g.moveTo(pad, y(target + s));
        g.lineTo(w, y(target + s));
        g.stroke();
        g.globalAlpha = 0.6;
        if (s % 2 === 0) {
          g.fillStyle = fg;
          g.fillText(keyName(target + s), pad - 6, y(target + s) + 3);
        }
      }
      g.globalAlpha = 0.18;
      g.fillStyle = good;
      const band = toleranceCents / 100;
      g.fillRect(pad, y(target + band), w - pad, y(target - band) - y(target + band));
      g.globalAlpha = 1;
      g.strokeStyle = good;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(pad, y(target));
      g.lineTo(w, y(target));
      g.stroke();

      // The sung line.
      const now = performance.now();
      const pts = points.current ?? [];
      g.lineWidth = 3;
      g.lineCap = "round";
      let prev: TrailPoint | null = null;
      for (const p of pts) {
        if (p.midi === null || now - p.t > SECONDS * 1000) {
          prev = null;
          continue;
        }
        const x = pad + (w - pad) * (1 - (now - p.t) / (SECONDS * 1000));
        // Notes outside the view ride along its top or bottom edge.
        const clamp = (v: number) => Math.max(target - RANGE + 0.3, Math.min(target + RANGE - 0.3, v));
        const m = clamp(p.midi);
        // A jump of more than a semitone is a new note: don't draw a line through the gap.
        if (prev && prev.midi !== null && Math.abs(p.midi - prev.midi) <= 1) {
          const px = pad + (w - pad) * (1 - (now - prev.t) / (SECONDS * 1000));
          const pm = clamp(prev.midi);
          g.strokeStyle = p.inTune ? good : bad;
          g.beginPath();
          g.moveTo(px, y(pm));
          g.lineTo(x, y(m));
          g.stroke();
        }
        prev = p;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [points, target, toleranceCents]);

  return (
    <canvas
      ref={ref}
      className="h-[180px] w-full rounded-lg border bg-background"
      role="img"
      aria-label="Your pitch over the last six seconds, against the target note"
    />
  );
}
