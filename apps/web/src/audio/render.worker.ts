/// <reference lib="webworker" />
/**
 * Render worker: runs the sound engine off the main thread so the UI never
 * freezes while audio is synthesised or a recording is analysed.
 */
import {
  analyzeVoice,
  processVoice,
  renderMelody,
  type Note,
  type RenderOptions,
  type Tone,
  type VoiceAnalysis,
  type VoiceSettings,
} from "@voxilizer/engine";

export type WorkerRequest =
  | { id: number; kind: "melody"; notes: Note[]; options: RenderOptions }
  | { id: number; kind: "take-load"; takeId: number; samples: Float32Array; sampleRate: number }
  | {
      id: number;
      kind: "take-process";
      takeId: number;
      tone: Tone;
      voice: Pick<VoiceSettings, "larynx" | "twang">;
      clean: boolean;
    };

export interface TakeInfo {
  durationSeconds: number;
  medianF0: number;
  voicedShare: number;
  loudestStart: number;
}

export type WorkerResponse =
  | {
      id: number;
      ok: true;
      kind: "audio";
      samples: Float32Array;
      sampleRate: number;
      secondsPerStep: number;
      ms: number;
    }
  | { id: number; ok: true; kind: "take"; info: TakeInfo }
  | { id: number; ok: false; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const takes = new Map<number, { samples: Float32Array; analysis: VoiceAnalysis }>();

function sendAudio(
  id: number,
  samples: Float32Array,
  sampleRate: number,
  secondsPerStep: number,
  t0: number,
) {
  const msg: WorkerResponse = {
    id,
    ok: true,
    kind: "audio",
    samples,
    sampleRate,
    secondsPerStep,
    ms: performance.now() - t0,
  };
  ctx.postMessage(msg, [samples.buffer]);
}

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  const t0 = performance.now();
  try {
    if (req.kind === "melody") {
      const r = renderMelody(req.notes, req.options);
      if (!r) throw new Error("There are no notes to play.");
      sendAudio(req.id, r.samples, r.sampleRate, r.secondsPerStep, t0);
    } else if (req.kind === "take-load") {
      const analysis = analyzeVoice(req.samples, req.sampleRate);
      takes.clear(); // one take at a time
      takes.set(req.takeId, { samples: req.samples, analysis });
      ctx.postMessage({
        id: req.id,
        ok: true,
        kind: "take",
        info: {
          durationSeconds: req.samples.length / req.sampleRate,
          medianF0: analysis.medianF0,
          voicedShare: analysis.voicedShare,
          loudestStart: analysis.loudestStart,
        },
      } satisfies WorkerResponse);
    } else {
      const take = takes.get(req.takeId);
      if (!take) throw new Error("Record or upload a take first.");
      const out = req.clean
        ? take.samples.slice()
        : processVoice(take.samples, take.analysis, req.tone, req.voice);
      sendAudio(req.id, out, take.analysis.sampleRate, 0, t0);
    }
  } catch (err) {
    ctx.postMessage({
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } satisfies WorkerResponse);
  }
};
