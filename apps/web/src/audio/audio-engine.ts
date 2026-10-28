/**
 * Browser audio host: owns the AudioContext, the playback worklet and the
 * render worker. Three threads, one job each:
 *   main thread  → UI (this class's callers)
 *   render worker → engine synthesis (render.worker.ts)
 *   audio thread → playback (public/worklets/player.js)
 */
import type { Note, RenderOptions } from "@voxilizer/engine";
import type { RenderRequest, RenderResponse } from "./render.worker";

export interface PlaybackInfo {
  durationSeconds: number;
  secondsPerStep: number;
  renderMs: number;
}

type PlayerMessage = { type: "position"; id: number; seconds: number } | { type: "ended"; id: number };

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, (r: RenderResponse) => void>();
  private playingId = 0;

  /** Called with seconds since the start of the current playback. */
  onPosition: ((seconds: number) => void) | null = null;
  onEnded: (() => void) | null = null;

  /** Must be called from a user gesture (browsers block audio until then). */
  async start(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: "interactive" });
      await this.ctx.audioWorklet.addModule("/worklets/player.js");
      this.node = new AudioWorkletNode(this.ctx, "vox-player", { outputChannelCount: [2] });
      this.node.connect(this.ctx.destination);
      this.node.port.onmessage = (e: MessageEvent<PlayerMessage>) => {
        if (e.data.id !== this.playingId) return;
        if (e.data.type === "position") this.onPosition?.(e.data.seconds);
        else this.onEnded?.();
      };
      this.worker = new Worker(new URL("./render.worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (e: MessageEvent<RenderResponse>) => {
        this.pending.get(e.data.id)?.(e.data);
        this.pending.delete(e.data.id);
      };
    }
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 44100;
  }

  /** Render the notes in the worker at the device sample rate, then play them. */
  async playMelody(notes: Note[], options: Omit<RenderOptions, "sampleRate">): Promise<PlaybackInfo> {
    await this.start();
    const id = this.nextId++;
    const res = await new Promise<RenderResponse>((resolve) => {
      this.pending.set(id, resolve);
      const req: RenderRequest = { id, notes, options: { ...options, sampleRate: this.sampleRate } };
      this.worker!.postMessage(req);
    });
    if (!res.ok) throw new Error(res.error);
    // Read the length before transferring: the transfer detaches the buffer.
    const durationSeconds = res.samples.length / res.sampleRate;
    this.playingId = id;
    this.node!.port.postMessage({ type: "play", samples: res.samples, id }, [res.samples.buffer]);
    return {
      durationSeconds,
      secondsPerStep: res.secondsPerStep,
      renderMs: res.renderMs,
    };
  }

  stop(): void {
    this.node?.port.postMessage({ type: "stop" });
  }

  /** True when the page is cross-origin isolated (SharedArrayBuffer available). */
  static get isolated(): boolean {
    return typeof window !== "undefined" && window.crossOriginIsolated === true;
  }

  async dispose(): Promise<void> {
    this.worker?.terminate();
    await this.ctx?.close();
    this.ctx = null;
    this.node = null;
    this.worker = null;
  }
}
