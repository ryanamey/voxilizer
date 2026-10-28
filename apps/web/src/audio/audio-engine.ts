/**
 * Browser audio host: owns the AudioContext, the playback worklet and the
 * render worker. Three threads, one job each:
 *   main thread   → UI (callers of this class)
 *   render worker → engine synthesis and voice processing (render.worker.ts)
 *   audio thread  → playback (public/worklets/player.js)
 */
import { prepareTake, type Note, type RenderOptions, type Tone, type VoiceSettings } from "@voxilizer/engine";
import type { TakeInfo, WorkerRequest, WorkerResponse } from "./render.worker";

export type { TakeInfo };

export interface RenderedAudio {
  /** A copy kept on the main thread for scopes; the original buffer is handed to the player. */
  samples: Float32Array;
  sampleRate: number;
  secondsPerStep: number;
  renderMs: number;
}

type PlayerMessage = { type: "position"; id: number; seconds: number } | { type: "ended"; id: number };
type Pending = (r: WorkerResponse) => void;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private worker: Worker | null = null;
  private starting: Promise<void> | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private playingId = 0;
  private takeId = 0;

  private onPosition: ((seconds: number) => void) | null = null;
  private onEnded: (() => void) | null = null;

  /** Subscribe to playback progress (seconds since start) and end. Returns an unsubscribe function. */
  listen(handlers: { onPosition: (seconds: number) => void; onEnded: () => void }): () => void {
    this.onPosition = handlers.onPosition;
    this.onEnded = handlers.onEnded;
    return () => {
      this.onPosition = null;
      this.onEnded = null;
    };
  }

  /** Set up the audio graph and worker. Safe without a user gesture (audio stays suspended). */
  ready(): Promise<void> {
    this.starting ??= this.init();
    return this.starting;
  }

  /** Start sound output. Call from a user gesture: browsers block sound until then. */
  async start(): Promise<void> {
    await this.ready();
    if (this.ctx!.state !== "running") await this.ctx!.resume();
  }

  private async init() {
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
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      this.pending.get(e.data.id)?.(e.data);
      this.pending.delete(e.data.id);
    };
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 44100;
  }

  private request(
    req: DistributiveOmit<WorkerRequest, "id">,
    transfer: Transferable[] = [],
  ): Promise<WorkerResponse> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker!.postMessage({ ...req, id } as WorkerRequest, transfer);
    });
  }

  private async audio(req: DistributiveOmit<WorkerRequest, "id">): Promise<RenderedAudio> {
    await this.ready();
    const res = await this.request(req);
    if (!res.ok) throw new Error(res.error);
    if (res.kind !== "audio") throw new Error("Unexpected response from the audio engine.");
    return {
      samples: res.samples,
      sampleRate: res.sampleRate,
      secondsPerStep: res.secondsPerStep,
      renderMs: res.ms,
    };
  }

  /** Render notes at the device sample rate (without playing). */
  renderMelody(notes: Note[], options: Omit<RenderOptions, "sampleRate">): Promise<RenderedAudio> {
    return this.audio({ kind: "melody", notes, options: { ...options, sampleRate: this.sampleRate } });
  }

  /** Apply a tone to the loaded take (or return it clean). */
  renderTake(
    tone: Tone,
    voice: Pick<VoiceSettings, "larynx" | "twang" | "air">,
    clean = false,
  ): Promise<RenderedAudio> {
    return this.audio({ kind: "take-process", takeId: this.takeId, tone, voice, clean });
  }

  /** Decode, trim and analyse a recording or uploaded file. */
  async loadTake(blob: Blob, maxSeconds = 12): Promise<TakeInfo> {
    await this.ready();
    const decoded = await this.ctx!.decodeAudioData(await blob.arrayBuffer());
    const seconds = Math.min(decoded.duration, maxSeconds);
    // Resample to mono at the device rate so playback needs no conversion.
    const off = new OfflineAudioContext(1, Math.ceil(seconds * this.sampleRate), this.sampleRate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const mono = (await off.startRendering()).getChannelData(0);
    const take = prepareTake(mono, this.sampleRate, maxSeconds);
    if (!take) throw new Error("That clip is too short. Hold a vowel for 2–4 seconds.");
    this.takeId += 1;
    const res = await this.request(
      { kind: "take-load", takeId: this.takeId, samples: take, sampleRate: this.sampleRate },
      [take.buffer],
    );
    if (!res.ok) throw new Error(res.error);
    if (res.kind !== "take") throw new Error("Unexpected response from the audio engine.");
    return res.info;
  }

  /** Play rendered audio through the worklet. Keeps `audio.samples` usable by copying first. */
  async play(audio: RenderedAudio): Promise<void> {
    await this.start();
    const copy = audio.samples.slice();
    this.playingId = this.nextId++;
    this.node!.port.postMessage({ type: "play", samples: copy, id: this.playingId }, [copy.buffer]);
  }

  /** Play several clips back to back with a short gap (e.g. clean → with effect). */
  async playSequence(clips: RenderedAudio[], gapSeconds = 0.18): Promise<void> {
    const rate = clips[0]?.sampleRate ?? this.sampleRate;
    const gap = Math.floor(rate * gapSeconds);
    const total = clips.reduce((n, c) => n + c.samples.length, 0) + gap * Math.max(0, clips.length - 1);
    const joined = new Float32Array(total);
    let at = 0;
    clips.forEach((c, i) => {
      joined.set(c.samples, at);
      at += c.samples.length + (i < clips.length - 1 ? gap : 0);
    });
    await this.play({ samples: joined, sampleRate: rate, secondsPerStep: 0, renderMs: 0 });
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
    await this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.node = null;
    this.worker = null;
    this.starting = null;
  }
}
