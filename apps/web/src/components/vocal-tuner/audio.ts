import { detectPitch, hzToMidi } from "@voxilizer/engine";
import type { RenderedNote } from "./timbres";

export interface MicListener {
  stop: () => void;
  /** Ignore the microphone until this time (performance.now ms), e.g. while a reference note plays. */
  muteUntil: (ms: number) => void;
  context: AudioContext;
}

/**
 * Listen to the microphone and call `onReading` about 60 times a second with the sung pitch
 * (fractional MIDI) or null. Processing is off so the browser doesn't reshape the voice.
 */
export async function listenToMic(
  onReading: (midi: number | null, level: number, now: number) => void,
): Promise<MicListener> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const context = new AudioContext();
  await context.resume();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  // Enough samples for two periods of A1 plus a summation window, at any sample rate.
  analyser.fftSize = context.sampleRate > 50_000 ? 4096 : 2048;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);

  let raf = 0;
  let muted = 0;
  const tick = () => {
    const now = performance.now();
    analyser.getFloatTimeDomainData(buf);
    if (now < muted) onReading(null, 0, now);
    else {
      const r = detectPitch(buf, context.sampleRate);
      let sum = 0;
      for (const v of buf) sum += v * v;
      onReading(r ? hzToMidi(r.hz) : null, Math.sqrt(sum / buf.length), now);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    context,
    muteUntil: (ms) => (muted = ms),
    stop: () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void context.close();
    },
  };
}

let refContext: AudioContext | null = null;

/** The audio context reference notes play on: the microphone's while listening, else a shared one. */
export function referenceContext(context?: AudioContext): AudioContext {
  return context ?? (refContext ??= new AudioContext());
}

export interface PlayingNote {
  /** How long the note stays loud enough for the microphone to pick up (ms); Infinity if it loops. */
  audibleMs: number;
  /** Fade the note out (about 0.12 s) and stop it. Safe to call more than once. */
  stop: () => void;
  /** Called once when the note has finished or been stopped. */
  onEnded: (fn: () => void) => void;
}

/** Play a rendered reference note: once, or looping until stopped. */
export function playNote(note: RenderedNote, context: AudioContext): PlayingNote {
  void context.resume();
  const { samples, loop } = note;
  const buf = context.createBuffer(1, samples.length, context.sampleRate);
  buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
  const src = context.createBufferSource();
  src.buffer = buf;
  if (loop) {
    src.loop = true;
    src.loopStart = loop.start / context.sampleRate;
    src.loopEnd = loop.end / context.sampleRate;
  }
  const gain = context.createGain();
  src.connect(gain).connect(context.destination);
  src.start(context.currentTime + 0.01);

  let audibleMs = Infinity;
  if (!loop) {
    let peak = 0;
    for (const v of samples) peak = Math.max(peak, Math.abs(v));
    let last = samples.length - 1;
    while (last > 0 && Math.abs(samples[last]!) < peak * 0.03) last--; // about -30 dB
    audibleMs = ((last + 1) / context.sampleRate) * 1000 + 10;
  }
  let stopped = false;
  const ended: (() => void)[] = [];
  src.onended = () => ended.splice(0).forEach((fn) => fn());
  return {
    audibleMs,
    stop: () => {
      if (stopped) return;
      stopped = true;
      const t = context.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.12);
      src.stop(t + 0.13);
    },
    onEnded: (fn) => ended.push(fn),
  };
}
