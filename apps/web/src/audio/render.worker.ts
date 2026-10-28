/// <reference lib="webworker" />
/**
 * Render worker: runs the engine off the main thread so the UI never freezes
 * while a song is being synthesised.
 */
import { renderMelody, type Note, type RenderOptions } from "@voxilizer/engine";

export interface RenderRequest {
  id: number;
  notes: Note[];
  options: RenderOptions;
}

export type RenderResponse =
  | { id: number; ok: true; samples: Float32Array; sampleRate: number; secondsPerStep: number; renderMs: number }
  | { id: number; ok: false; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<RenderRequest>) => {
  const { id, notes, options } = e.data;
  const t0 = performance.now();
  try {
    const r = renderMelody(notes, options);
    if (!r) {
      ctx.postMessage({ id, ok: false, error: "There are no notes to play." } satisfies RenderResponse);
      return;
    }
    const msg: RenderResponse = {
      id,
      ok: true,
      samples: r.samples,
      sampleRate: r.sampleRate,
      secondsPerStep: r.secondsPerStep,
      renderMs: performance.now() - t0,
    };
    ctx.postMessage(msg, [r.samples.buffer]);
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies RenderResponse);
  }
};
