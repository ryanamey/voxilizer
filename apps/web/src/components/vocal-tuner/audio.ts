import { detectPitch, hzToMidi } from "@voxilizer/engine";

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

/** Play a soft, piano-like reference note. Returns its length in ms. */
export function playReference(midi: number, context?: AudioContext): number {
  const ctx = context ?? (refContext ??= new AudioContext());
  void ctx.resume();
  const hz = 440 * Math.pow(2, (midi - 69) / 12);
  const t0 = ctx.currentTime + 0.02;
  const dur = 1.4;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t0);
  out.gain.linearRampToValueAtTime(0.25, t0 + 0.01);
  out.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  out.connect(ctx.destination);
  [1, 0.45, 0.2, 0.1].forEach((amp, i) => {
    if (hz * (i + 1) > ctx.sampleRate / 2) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = hz * (i + 1);
    g.gain.value = amp;
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + dur);
  });
  return dur * 1000;
}
