/**
 * Real-time pitch detection for the Vocal Tuner: the McLeod Pitch Method (normalised square
 * difference function). Robust on the human voice and far less prone to octave errors than plain
 * autocorrelation. Pure: samples in, a reading out.
 */

export interface PitchReading {
  /** Fundamental frequency in Hz. */
  hz: number;
  /** How periodic the frame is, 0–1. Voiced singing is usually above 0.9. */
  clarity: number;
  /** Frame loudness (RMS, full scale = 1). */
  rms: number;
}

export interface PitchOptions {
  /** Lowest pitch to look for (Hz). Default 55 (A1). */
  minHz?: number;
  /** Highest pitch to look for (Hz). Default 1600 (about G6). */
  maxHz?: number;
  /** Frames quieter than this RMS are treated as silence. Default 0.008 (about −42 dBFS). */
  minRms?: number;
  /** Frames less periodic than this are rejected. Default 0.8. */
  minClarity?: number;
}

/** Peak-picking constant from McLeod & Wyvill (2005): take the first peak within 93% of the highest. */
const K = 0.93;
/** A subharmonic within 24 dB of the pitch's strongest harmonic means the pitch is that subharmonic. */
const SUBHARMONIC_RATIO = Math.pow(10, -24 / 10);

/** Second-order Butterworth low-pass (RBJ biquad). */
function lowpass(x: Float32Array, cutoff: number, sampleRate: number): Float32Array {
  const w = (2 * Math.PI * cutoff) / sampleRate;
  const alpha = Math.sin(w) / Math.SQRT2;
  const cw = Math.cos(w);
  const a0 = 1 + alpha;
  const b0 = (1 - cw) / 2 / a0,
    b1 = (1 - cw) / a0,
    a1 = (-2 * cw) / a0,
    a2 = (1 - alpha) / a0;
  const y = new Float32Array(x.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i]! + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i]!;
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/** Energy of one frequency in a Hann-windowed frame (Goertzel). */
function toneEnergy(x: Float32Array, mean: number, freq: number, sampleRate: number): number {
  const n = x.length;
  const c = 2 * Math.cos((2 * Math.PI * freq) / sampleRate);
  let s1 = 0,
    s2 = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    const s0 = (x[i]! - mean) * w + c * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - c * s1 * s2;
}

/**
 * Detect the pitch of one frame. Returns null for silence, noise or a frame too short for the
 * lowest pitch. The frame must hold at least two periods of `minHz` plus a summation window.
 */
export function detectPitch(
  input: Float32Array,
  sampleRate: number,
  opts: PitchOptions = {},
): PitchReading | null {
  const minHz = opts.minHz ?? 55;
  const maxHz = opts.maxHz ?? 1600;
  const minRms = opts.minRms ?? 0.008;
  const minClarity = opts.minClarity ?? 0.8;

  // Low-pass first: a strong resonance high in the spectrum (twang ring, EE's upper formants)
  // otherwise dominates the waveform's periodicity. Pitch lives below maxHz.
  const cutoff = Math.min(sampleRate * 0.45, maxHz * 1.25);
  const x = lowpass(lowpass(input, cutoff, sampleRate), cutoff, sampleRate);
  let energy = 0;
  let mean = 0;
  for (let i = 0; i < x.length; i++) mean += x[i]!;
  mean /= x.length || 1;
  for (let i = 0; i < x.length; i++) energy += (x[i]! - mean) ** 2;
  const rms = Math.sqrt(energy / (x.length || 1));
  if (rms < minRms) return null;

  const maxLag = Math.min(Math.floor(sampleRate / minHz), Math.floor(x.length / 2));
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const W = x.length - maxLag;
  if (W < maxLag || maxLag <= minLag) return null;

  // NSDF over lags 0..maxLag with a fixed window of W samples.
  const nsdf = new Float32Array(maxLag + 1);
  for (let tau = 0; tau <= maxLag; tau++) {
    let acf = 0,
      m = 0;
    for (let j = 0; j < W; j++) {
      const a = x[j]! - mean,
        b = x[j + tau]! - mean;
      acf += a * b;
      m += a * a + b * b;
    }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
  }

  // Key maxima: the highest point of each positive lobe after the first negative zero crossing.
  const peaks: number[] = [];
  let tau = 1;
  while (tau < maxLag && nsdf[tau]! > 0) tau++;
  while (tau < maxLag) {
    while (tau < maxLag && nsdf[tau]! <= 0) tau++;
    let best = -1;
    while (tau < maxLag && nsdf[tau]! > 0) {
      if (tau >= minLag && (best < 0 || nsdf[tau]! > nsdf[best]!)) best = tau;
      tau++;
    }
    if (best > 0) peaks.push(best);
  }
  if (!peaks.length) return null;

  let highest = 0;
  for (const p of peaks) highest = Math.max(highest, nsdf[p]!);
  const chosen = peaks.find((p) => nsdf[p]! >= K * highest)!;

  // Parabolic interpolation around the chosen lag.
  const y0 = nsdf[chosen - 1]!,
    y1 = nsdf[chosen]!,
    y2 = nsdf[chosen + 1] ?? y1;
  const denom = y0 - 2 * y1 + y2;
  const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
  const period = chosen + Math.max(-0.5, Math.min(0.5, shift));
  const clarity = Math.min(1, y1 - 0.25 * (y0 - y2) * shift);
  if (clarity < minClarity) return null;

  let hz = sampleRate / period;
  // Octave guard. Voices with a weak fundamental (belted vowels with F1 on the 2nd harmonic, Edge,
  // high EE) are almost periodic at half or a third of the true period. The spectrum tells them
  // apart: if there is real energy at f/d and its non-multiples of d (e.g. f/2, 3f/2), the true
  // pitch is f/d.
  for (const d of [2, 3]) {
    const sub = hz / d;
    if (sub < minHz) continue;
    let ref = 0;
    for (let k = 1; k <= 4 && hz * k < sampleRate / 2; k++)
      ref = Math.max(ref, toneEnergy(x, mean, hz * k, sampleRate));
    let evidence = 0;
    for (let k = 1; k < 2 * d; k++)
      if (k % d) evidence = Math.max(evidence, toneEnergy(x, mean, sub * k, sampleRate));
    if (evidence > ref * SUBHARMONIC_RATIO) {
      hz = sub;
      break;
    }
  }
  if (hz < minHz || hz > maxHz) return null;
  return { hz, clarity, rms };
}

/** Frequency to a (fractional) MIDI number: 69 = A4 = 440 Hz. */
export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

/** The nearest note to a frequency and how far off it is, in cents (−50 to +50). */
export function nearestNote(hz: number): { midi: number; cents: number } {
  const m = hzToMidi(hz);
  const midi = Math.round(m);
  return { midi, cents: (m - midi) * 100 };
}
