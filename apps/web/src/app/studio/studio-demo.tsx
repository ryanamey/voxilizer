"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  analyzeLoad,
  exampleSong,
  MODES,
  EFFECTS,
  noteName,
  PITCH_MAX,
  PITCH_MIN,
  type Stage,
} from "@voxilizer/engine";
import { AudioEngine } from "@/audio/audio-engine";

const STAGE_CLASS: Record<Stage, string> = {
  0: "bg-emerald-500",
  1: "bg-emerald-500",
  2: "bg-indigo-500",
  3: "bg-amber-500",
  4: "bg-red-500",
};

/**
 * Step 1 proof of the audio plumbing: the example song is rendered by the
 * engine in a Web Worker and played through the AudioWorklet, with a playhead
 * driven by the worklet's position reports. The editable piano roll arrives in step 2.
 */
export function StudioDemo() {
  const song = useMemo(() => exampleSong(), []);
  const load = useMemo(() => analyzeLoad(song), [song]);
  const engineRef = useRef<AudioEngine | null>(null);
  const [status, setStatus] = useState<"idle" | "rendering" | "playing">("idle");
  const [position, setPosition] = useState(-1);
  const [stepSec, setStepSec] = useState(60 / song.tempo / 4);
  const [info, setInfo] = useState<string>("");
  const [error, setError] = useState<string>("");
  const isolated = useSyncExternalStore(
    () => () => {},
    () => AudioEngine.isolated,
    () => null,
  );

  useEffect(() => {
    const engine = new AudioEngine();
    engine.onPosition = (s) => setPosition(s);
    engine.onEnded = () => {
      setStatus("idle");
      setPosition(-1);
    };
    engineRef.current = engine;
    return () => {
      void engine.dispose();
    };
  }, []);

  async function play() {
    const engine = engineRef.current;
    if (!engine) return;
    setError("");
    setStatus("rendering");
    try {
      const r = await engine.playMelody(song.notes, { tempo: song.tempo, songTone: song.tone, voice: song.voice });
      setStepSec(r.secondsPerStep);
      setInfo(`${r.durationSeconds.toFixed(1)} s of audio rendered in ${Math.round(r.renderMs)} ms at ${engine.sampleRate} Hz`);
      setStatus("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Playback failed. Try again.");
      setStatus("idle");
    }
  }

  function stop() {
    engineRef.current?.stop();
  }

  const totalSteps = song.bars * 16;
  const rows = PITCH_MAX - PITCH_MIN + 1;
  const playStep = position >= 0 ? position / stepSec : -1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={play}
          disabled={status === "rendering"}
          className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {status === "rendering" ? "Rendering…" : "▶ Play example"}
        </button>
        <button type="button" onClick={stop} className="rounded-md border border-zinc-300 px-4 py-2 font-semibold dark:border-zinc-700">
          ■ Stop
        </button>
        <span className="text-sm text-zinc-500">{info}</span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="relative" style={{ width: totalSteps * 14, height: rows * 6 }}>
          {song.notes.map((n) => {
            const stage = load.noteStages[n.id] ?? 0;
            const tone = n.tone ?? song.tone;
            return (
              <div
                key={n.id}
                title={`${noteName(n.pitch)} ${n.vowel} · ${MODES[tone.mode].label}${tone.effect !== "none" ? ` + ${EFFECTS[tone.effect].label}` : ""}${tone.ff ? ` + ${tone.ff}% distortion` : ""} · stage ${stage}`}
                className="absolute overflow-hidden rounded-sm bg-indigo-500/85 text-[9px] font-semibold leading-none text-white"
                style={{ left: n.start * 14 + 1, top: (PITCH_MAX - n.pitch) * 6 - 3, width: n.length * 14 - 2, height: 12 }}
              >
                <span className="px-0.5">{n.vowel}</span>
                <span className={`absolute inset-x-0 bottom-0 h-[3px] ${STAGE_CLASS[stage]}`} />
              </div>
            );
          })}
          {playStep >= 0 && <div className="absolute inset-y-0 w-0.5 bg-red-500" style={{ left: playStep * 14 }} />}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div><dt className="text-zinc-500">Sung</dt><dd className="font-mono">{load.sungSeconds.toFixed(1)} s</dd></div>
        <div><dt className="text-zinc-500">With an effect</dt><dd className="font-mono">{Math.round(load.roughShare * 100)}%</dd></div>
        <div><dt className="text-zinc-500">Heaviest note</dt><dd className="font-mono">Stage {load.heaviestStage}</dd></div>
        <div>
          <dt className="text-zinc-500">Cross-origin isolated</dt>
          <dd className="font-mono">{isolated === null ? "…" : isolated ? "yes" : "no (check headers)"}</dd>
        </div>
      </dl>
      {load.warnings.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-amber-700 dark:text-amber-400">
          {load.warnings.map((w) => <li key={w.kind}>{w.message}</li>)}
        </ul>
      )}
    </div>
  );
}
