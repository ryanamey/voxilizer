"use client";

import { useEffect, useRef } from "react";
import { magnitudeSpectrum } from "@voxilizer/engine";
import type { RenderedAudio } from "@/audio/audio-engine";

/** Read a CSS custom property (theme token) for canvas drawing. */
export function cssVar(el: Element, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || "#888";
}

/** Size a canvas for crisp drawing on high-DPI screens; returns its CSS size. */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  cssHeight: number,
): { g: CanvasRenderingContext2D; w: number; h: number } {
  const r = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 300;
  canvas.width = Math.floor(w * r);
  canvas.height = Math.floor(cssHeight * r);
  const g = canvas.getContext("2d")!;
  g.setTransform(r, 0, 0, r, 0, 0);
  return { g, w, h: cssHeight };
}

function drawEmpty(g: CanvasRenderingContext2D, w: number, h: number, el: Element) {
  g.fillStyle = cssVar(el, "--muted-foreground");
  g.font = `13px ${cssVar(el, "--font-sans") || "sans-serif"}`;
  g.textAlign = "center";
  g.fillText("Nothing to show yet", w / 2, h / 2 + 4);
}

interface ScopeProps {
  audio: RenderedAudio | null;
  /** Second into the audio where the steady part starts. */
  from: number;
  /** Pitch (Hz) to mark on the spectrum, with its half-pitch. */
  f0: number | null;
  caption: string;
}

export function Scopes({ audio, from, f0, caption }: ScopeProps) {
  const wave = useRef<HTMLCanvasElement>(null);
  const spec = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const draw = () => {
      const wc = wave.current,
        sc = spec.current;
      if (!wc || !sc) return;
      const ink = cssVar(wc, "--foreground"),
        muted = cssVar(wc, "--muted-foreground"),
        line = cssVar(wc, "--border"),
        acc = cssVar(wc, "--primary");

      // Waveform: 60 ms from the steady part.
      {
        const { g, w, h } = fitCanvas(wc, 104);
        g.clearRect(0, 0, w, h);
        if (!audio) drawEmpty(g, w, h, wc);
        else {
          const x = audio.samples,
            len = Math.floor(audio.sampleRate * 0.06);
          const start = Math.max(
            0,
            Math.min(Math.floor(audio.sampleRate * (from + 0.1)), x.length - len - 1),
          );
          g.strokeStyle = line;
          g.beginPath();
          g.moveTo(0, h / 2);
          g.lineTo(w, h / 2);
          g.stroke();
          g.strokeStyle = ink;
          g.lineWidth = 1.3;
          g.beginPath();
          for (let px = 0; px < w; px++) {
            const v = x[start + Math.floor((px / w) * len)] ?? 0;
            const y = h / 2 - v * (h / 2 - 6);
            if (px) g.lineTo(px, y);
            else g.moveTo(px, y);
          }
          g.stroke();
        }
      }

      // Spectrum 0–3 kHz, with pitch and half-pitch markers.
      {
        const { g, w, h } = fitCanvas(sc, 150);
        g.clearRect(0, 0, w, h);
        if (!audio) drawEmpty(g, w, h, sc);
        else {
          const size = 8192,
            fmax = 3000;
          const start = Math.max(
            0,
            Math.min(Math.floor(audio.sampleRate * from), audio.samples.length - size),
          );
          const { db, binHz } = magnitudeSpectrum(audio.samples, audio.sampleRate, start, size, fmax);
          const floor = -70,
            top = 8,
            bottom = h - 18;
          const yOf = (v: number) => top + (1 - (Math.max(floor, v) - floor) / -floor) * (bottom - top);
          const at = (px: number) =>
            db[Math.max(1, Math.min(db.length - 1, Math.floor(((px / w) * fmax) / binHz)))] ?? floor;
          g.font = `10.5px ${cssVar(sc, "--font-mono") || "monospace"}`;
          g.textAlign = "center";
          g.strokeStyle = line;
          g.fillStyle = muted;
          for (let f = 0; f <= fmax; f += 500) {
            const px = (f / fmax) * w;
            g.beginPath();
            g.moveTo(px, top);
            g.lineTo(px, bottom);
            g.stroke();
            if (f > 0 && f < fmax) g.fillText(f >= 1000 ? `${f / 1000}k` : String(f), px, h - 4);
          }
          g.beginPath();
          g.moveTo(0, bottom);
          for (let px = 0; px < w; px++) g.lineTo(px, yOf(at(px)));
          g.lineTo(w, bottom);
          g.closePath();
          g.globalAlpha = 0.16;
          g.fillStyle = acc;
          g.fill();
          g.globalAlpha = 1;
          g.strokeStyle = acc;
          g.lineWidth = 1.2;
          g.beginPath();
          for (let px = 0; px < w; px++) (px ? g.lineTo : g.moveTo).call(g, px, yOf(at(px)));
          g.stroke();
          if (f0) {
            g.textAlign = "left";
            for (const [f, label, dy] of [
              [f0, "f0", 10],
              [f0 / 2, "f0/2", 22],
            ] as const) {
              const px = (f / fmax) * w;
              g.setLineDash([3, 3]);
              g.strokeStyle = muted;
              g.beginPath();
              g.moveTo(px, top);
              g.lineTo(px, bottom);
              g.stroke();
              g.setLineDash([]);
              g.fillStyle = muted;
              g.fillText(label, px + 3, top + dy);
            }
          }
        }
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    if (wave.current) ro.observe(wave.current);
    const mo = new MutationObserver(draw);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [audio, from, f0]);

  return (
    <div className="flex flex-col gap-3">
      <figure className="flex flex-col gap-1 rounded-lg border bg-scope p-2.5">
        <figcaption className="flex justify-between gap-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          <span>Waveform · 60 ms</span>
          <span className="truncate">{caption}</span>
        </figcaption>
        <canvas ref={wave} className="h-[104px] w-full" role="img" aria-label={`Waveform: ${caption}`} />
      </figure>
      <figure className="flex flex-col gap-1 rounded-lg border bg-scope p-2.5">
        <figcaption className="flex justify-between gap-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          <span>Spectrum · 0–3 kHz</span>
          <span>dashed: pitch and half-pitch</span>
        </figcaption>
        <canvas
          ref={spec}
          className="h-[150px] w-full"
          role="img"
          aria-label="Spectrum of the designed sound"
        />
      </figure>
    </div>
  );
}
