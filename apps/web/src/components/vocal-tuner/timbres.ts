/**
 * Reference-note timbres for the Vocal Tuner, generated in the browser (nothing to download).
 * Pure functions: midi in, samples out, so tests can check every timbre is exactly in tune.
 */
import { DEFAULT_TONE, renderTone, type SingerId, type Tone } from "@voxilizer/engine";

export const TIMBRES = {
  clean: { label: "Clean", hint: "pure, held" },
  piano: { label: "Piano", hint: "struck, fades" },
  guitar: { label: "Guitar", hint: "plucked, fades" },
  voice: { label: "Voice", hint: "sung AH, held" },
  mix: { label: "Mix", hint: "a new one each note" },
} as const;
export type TimbreId = keyof typeof TIMBRES;
/** The timbres Mix picks from. */
export const MIX_POOL = ["clean", "piano", "guitar", "voice"] as const satisfies readonly TimbreId[];
export type SoundId = (typeof MIX_POOL)[number];

const hzOf = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Scale to a common peak so switching timbre doesn't jump in loudness. */
function normalize(x: Float32Array, peak = 0.45): Float32Array {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i]! / m) * peak;
  return x;
}

/** Short fades so a buffer never starts or stops with a click. */
function fadeEdges(x: Float32Array, sr: number, inS = 0.008, outS = 0.08) {
  const a = Math.floor(sr * inS),
    b = Math.floor(sr * outS);
  for (let i = 0; i < a && i < x.length; i++) x[i]! *= i / a;
  for (let i = 0; i < b && i < x.length; i++) x[x.length - 1 - i]! *= i / b;
}

/** A pure, steady tone with a few soft overtones: easy to sing along to. */
export function cleanTone(midi: number, sr: number, seconds = 2): Float32Array {
  const f = hzOf(midi);
  const n = Math.floor(sr * seconds);
  const x = new Float32Array(n);
  const parts = [1, 0.45, 0.2, 0.1];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0;
    parts.forEach((a, k) => {
      if (f * (k + 1) < sr / 2) v += a * Math.sin(2 * Math.PI * f * (k + 1) * t);
    });
    x[i] = v;
  }
  fadeEdges(x, sr, 0.02, 0.25);
  return normalize(x);
}

/**
 * A piano-like note: a hammer attack, slightly stretched overtones (string stiffness), and a decay
 * that is faster for higher notes and higher overtones.
 */
export function pianoTone(midi: number, sr: number, seconds = 2.5): Float32Array {
  const f = hzOf(midi);
  const n = Math.floor(sr * seconds);
  const x = new Float32Array(n);
  const B = 0.0004 * Math.pow(2, (midi - 60) / 24); // inharmonicity grows up the keyboard
  const baseDecay = 0.9 + (midi - 36) * 0.06; // per second
  const partials: { f: number; a: number; d: number }[] = [];
  for (let k = 1; k <= 14; k++) {
    const fk = k * f * Math.sqrt(1 + B * k * k);
    if (fk >= sr / 2) break;
    // Hammer strikes near the end of the string: overtones fall off, a little uneven.
    const a = (1 / Math.pow(k, 1.1)) * (k % 7 === 0 ? 0.3 : 1);
    partials.push({ f: fk, a, d: baseDecay * (1 + 0.35 * (k - 1)) });
  }
  // Each partial is a decaying sine, advanced by a rotation per sample (no sin/exp per sample).
  for (const p of partials) {
    const w = (2 * Math.PI * p.f) / sr;
    const r = Math.exp(-p.d / sr);
    const cr = Math.cos(w) * r,
      sr_ = Math.sin(w) * r;
    let re = p.a,
      im = 0;
    for (let i = 0; i < n; i++) {
      x[i]! += im;
      const nre = re * cr - im * sr_;
      im = re * sr_ + im * cr;
      re = nre;
    }
  }
  // Hammer thump: a few ms of decaying noise at the attack.
  let seed = midi * 7919 + 1;
  const thump = Math.floor(sr * 0.012);
  for (let i = 0; i < thump && i < n; i++) {
    seed = (seed * 16807) % 2147483647;
    x[i]! += (seed / 2147483647 - 0.5) * 0.25 * (1 - i / thump);
  }
  fadeEdges(x, sr, 0.002, 0.1);
  return normalize(x);
}

/**
 * A plucked string (Karplus–Strong), with an all-pass fractional delay so the pitch is exact,
 * not rounded to a whole number of samples.
 */
export function guitarTone(midi: number, sr: number, seconds = 3): Float32Array {
  const f = hzOf(midi);
  const n = Math.floor(sr * seconds);
  const x = new Float32Array(n);
  // Each pass averages a sample with the next (newer) one, so the loop is half a sample shorter
  // than the line: the line plus the all-pass must hold one period plus half a sample.
  const D = sr / f + 0.5;
  const L = Math.floor(D - 0.5); // keep the fractional part in [0.5, 1.5) for a stable all-pass
  const frac = D - L;
  const C = (1 - frac) / (1 + frac);
  // Excite with smoothed noise (a pick, not a hammer) to soften the very bright start.
  const line = new Float32Array(L);
  let seed = midi * 104729 + 3;
  let prev = 0;
  for (let i = 0; i < L; i++) {
    seed = (seed * 16807) % 2147483647;
    const r = seed / 2147483647 - 0.5;
    prev = 0.6 * r + 0.4 * prev;
    line[i] = prev;
  }
  // Higher strings ring shorter, as on a real guitar.
  const decay = Math.min(0.9995, 0.998 - (midi - 52) * 0.00004);
  let idx = 0;
  let apX = 0,
    apY = 0;
  for (let i = 0; i < n; i++) {
    const cur = line[idx]!;
    const nxt = line[(idx + 1) % L]!;
    const avg = 0.5 * (cur + nxt) * decay;
    // First-order all-pass: y = C*x + x[-1] - C*y[-1]
    const ap = C * avg + apX - C * apY;
    apX = avg;
    apY = ap;
    line[idx] = ap;
    idx = (idx + 1) % L;
    x[i] = cur;
  }
  fadeEdges(x, sr, 0.002, 0.15);
  return normalize(x);
}

/** The singer's own kind of sound: a clean, sustained AH from the Voxilizer voice engine. */
export function voiceTone(midi: number, sr: number, singer: SingerId, seconds = 2): Float32Array {
  const tone: Tone = { ...DEFAULT_TONE, mode: "neutral", density: "fuller", volume: 5, air: 0 };
  const r = renderTone(tone, "AH", midi, { singer }, seconds, sr);
  return normalize(r.samples.slice());
}

export function renderTimbre(sound: SoundId, midi: number, sr: number, singer: SingerId): Float32Array {
  switch (sound) {
    case "clean":
      return cleanTone(midi, sr);
    case "piano":
      return pianoTone(midi, sr);
    case "guitar":
      return guitarTone(midi, sr);
    case "voice":
      return voiceTone(midi, sr, singer);
  }
}

/** Pick a timbre for Mix, never the same one twice in a row. */
export function nextMix(previous: SoundId | null, rand = Math.random): SoundId {
  const pool = MIX_POOL.filter((s) => s !== previous);
  return pool[Math.floor(rand() * pool.length)]!;
}
