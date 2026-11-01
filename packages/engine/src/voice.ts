/**
 * "My voice": apply effects to the singer's own recorded take.
 *
 * Method (LPC source–filter split): each short frame of the take is modelled as
 * a source (the vocal-fold buzz, recovered as the LPC residual) passed through
 * a filter (the vowel/throat shape, the LPC coefficients). Effects are added to
 * the source in time with the singer's own pitch, then the singer's filter is
 * put back on, so the result keeps their pitch, vowel and timbre.
 * Ported from the Grit Lab prototype.
 */
import { tractOf, type Tone } from "./song";
import { createRng } from "./util";

const HOP = 256;
const WINDOW = 1024;
const ORDER = 26;
const PRE_EMPHASIS = 0.95;

export interface VoiceAnalysis {
  sampleRate: number;
  /** Pre-emphasised take. */
  pre: Float32Array;
  /** LPC coefficients per hop (a[0] = 1). */
  coefs: Float64Array[];
  /** Pitch in Hz per hop (unvoiced hops hold the last voiced value). */
  f0: Float32Array;
  /** 1 for voiced hops, 0 for unvoiced. */
  voiced: Uint8Array;
  /** Median pitch of the voiced part, or 0 when no steady pitch was found. */
  medianF0: number;
  /** Share of hops that are voiced, 0–1. */
  voicedShare: number;
  /** Start (seconds) of the loudest voiced region, for scope views. */
  loudestStart: number;
}

function levinson(r: Float64Array, p: number): Float64Array {
  const a = new Float64Array(p + 1);
  a[0] = 1;
  let err = r[0]!;
  for (let i = 1; i <= p; i++) {
    let acc = r[i]!;
    for (let j = 1; j < i; j++) acc += a[j]! * r[i - j]!;
    const k = -acc / err;
    const prev = a.slice();
    a[i] = k;
    for (let j = 1; j < i; j++) a[j] = prev[j]! + k * prev[i - j]!;
    err *= 1 - k * k;
    if (err <= 1e-12) break;
  }
  return a;
}

/** Analyse a mono take: LPC filter per hop and a pitch track. */
export function analyzeVoice(x: Float32Array, sampleRate: number): VoiceAnalysis {
  const N = x.length;
  const hops = Math.ceil(N / HOP) + 2;
  const pre = new Float32Array(N);
  if (N) pre[0] = x[0]!;
  for (let n = 1; n < N; n++) pre[n] = x[n]! - PRE_EMPHASIS * x[n - 1]!;

  const win = new Float64Array(WINDOW);
  for (let j = 0; j < WINDOW; j++) win[j] = 0.5 - 0.5 * Math.cos((2 * Math.PI * j) / (WINDOW - 1));

  // Pitch is tracked on a 4× decimated copy for speed.
  const D = 4;
  const Nd = Math.floor(N / D);
  const xd = new Float32Array(Nd);
  for (let i = 0; i < Nd; i++) xd[i] = (x[D * i]! + x[D * i + 1]! + x[D * i + 2]! + x[D * i + 3]!) / 4;
  const srD = sampleRate / D;
  const wD = Math.round(400 * (srD / 11025));
  const minLag = Math.floor(srD / 900);
  const maxLag = Math.floor(srD / 65);
  const at = (i: number) => (i >= 0 && i < Nd ? xd[i]! : 0);

  let globalPeak = 1e-9;
  for (let n = 0; n < N; n++) globalPeak = Math.max(globalPeak, Math.abs(x[n]!));

  const coefs: Float64Array[] = new Array(hops);
  const f0 = new Float32Array(hops);
  const voiced = new Uint8Array(hops);
  const frame = new Float64Array(WINDOW);
  const r = new Float64Array(ORDER + 1);

  for (let h = 0; h < hops; h++) {
    const c = h * HOP;
    for (let j = 0; j < WINDOW; j++) {
      const idx = c - WINDOW / 2 + j;
      frame[j] = idx >= 0 && idx < N ? pre[idx]! * win[j]! : 0;
    }
    for (let k = 0; k <= ORDER; k++) {
      let s = 0;
      for (let j = k; j < WINDOW; j++) s += frame[j]! * frame[j - k]!;
      r[k] = s;
    }
    if (r[0]! < 1e-10) {
      const flat = new Float64Array(ORDER + 1);
      flat[0] = 1;
      coefs[h] = flat;
    } else {
      r[0] = r[0]! * 1.0001; // slight lag window for numerical stability
      coefs[h] = levinson(r, ORDER);
    }

    const cd = Math.floor(c / D) - Math.floor(wD / 2);
    let mean = 0;
    for (let i = 0; i < wD; i++) mean += at(cd + i);
    mean /= wD;
    let rms = 0;
    for (let i = 0; i < wD; i++) rms += (at(cd + i) - mean) ** 2;
    rms = Math.sqrt(rms / wD);
    let best = 0;
    let bestLag = 0;
    if (rms > 0.03 * globalPeak) {
      for (let L = minLag; L <= maxLag; L++) {
        let s = 0,
          e1 = 0,
          e2 = 0;
        for (let i = 0; i < wD - L; i++) {
          const a1 = at(cd + i) - mean,
            a2 = at(cd + i + L) - mean;
          s += a1 * a2;
          e1 += a1 * a1;
          e2 += a2 * a2;
        }
        const nr = s / Math.sqrt(e1 * e2 + 1e-12);
        if (nr > best + 0.02) {
          best = nr;
          bestLag = L;
        }
      }
    }
    if (best > 0.5 && bestLag) {
      f0[h] = srD / bestLag;
      voiced[h] = 1;
    }
  }

  const voicedF0: number[] = [];
  for (let h = 0; h < hops; h++) if (voiced[h]) voicedF0.push(f0[h]!);
  voicedF0.sort((p, q) => p - q);
  const medianF0 = voicedF0.length ? voicedF0[Math.floor(voicedF0.length / 2)]! : 0;
  let last = medianF0 || 150;
  for (let h = 0; h < hops; h++) {
    if (voiced[h] && medianF0 && (f0[h]! > medianF0 * 1.7 || f0[h]! < medianF0 * 0.6)) f0[h] = medianF0;
    if (voiced[h]) last = f0[h]!;
    else f0[h] = last;
  }

  let loud = 0,
    loudHop = 0;
  for (let h = 0; h < hops; h++) {
    if (!voiced[h]) continue;
    let s = 0;
    const c = h * HOP;
    for (let j = 0; j < HOP && c + j < N; j++) s += x[c + j]! ** 2;
    if (s > loud) {
      loud = s;
      loudHop = h;
    }
  }

  return {
    sampleRate,
    pre,
    coefs,
    f0,
    voiced,
    medianF0,
    voicedShare: hops ? voicedF0.length / hops : 0,
    loudestStart: Math.max(0, loudHop * HOP - sampleRate * 0.03) / sampleRate,
  };
}

type Biquad = [number, number, number, number, number];

function biquad(type: "peak" | "low" | "high", f: number, gainDb: number, Q: number, sr: number): Biquad {
  const A = Math.pow(10, gainDb / 40),
    w0 = (2 * Math.PI * f) / sr,
    cs = Math.cos(w0),
    sn = Math.sin(w0);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (type === "peak") {
    const al = sn / (2 * Q);
    b0 = 1 + al * A;
    b1 = -2 * cs;
    b2 = 1 - al * A;
    a0 = 1 + al / A;
    a1 = -2 * cs;
    a2 = 1 - al / A;
  } else {
    const al = (sn / 2) * Math.SQRT2,
      sA = 2 * Math.sqrt(A) * al;
    if (type === "high") {
      b0 = A * (A + 1 + (A - 1) * cs + sA);
      b1 = -2 * A * (A - 1 + (A + 1) * cs);
      b2 = A * (A + 1 + (A - 1) * cs - sA);
      a0 = A + 1 - (A - 1) * cs + sA;
      a1 = 2 * (A - 1 - (A + 1) * cs);
      a2 = A + 1 - (A - 1) * cs - sA;
    } else {
      b0 = A * (A + 1 - (A - 1) * cs + sA);
      b1 = 2 * A * (A - 1 - (A + 1) * cs);
      b2 = A * (A + 1 - (A - 1) * cs - sA);
      a0 = A + 1 + (A - 1) * cs + sA;
      a1 = -2 * (A - 1 + (A + 1) * cs);
      a2 = A + 1 + (A - 1) * cs - sA;
    }
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

function applyBiquad(x: Float32Array, c: Biquad): Float32Array<ArrayBuffer> {
  const y = new Float32Array(x.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = c[0] * x[i]! + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
    x2 = x1;
    x1 = x[i]!;
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

export function normalize(x: Float32Array, peakTarget = 0.85): Float32Array<ArrayBuffer> {
  let pk = 1e-9;
  for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]!));
  const g = peakTarget / pk;
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i]! * g;
  return y;
}

/** Apply a tone (effects + tract settings) to an analysed take. Returns new audio. */
export function processVoice(x: Float32Array, an: VoiceAnalysis, tone: Tone, seed = 11): Float32Array {
  const N = x.length,
    SR = an.sampleRate,
    pre = an.pre,
    C = an.coefs;
  const a = tone.effect === "none" ? 0 : tone.amount / 100;
  const d = tone.ff / 100,
    air = tone.mode === "neutral" ? tone.air / 100 : 0; // CVT: audible air only in Neutral
  const cr = tone.effect === "creak" ? a : 0,
    gr = tone.effect === "growl" ? a : 0;
  const ra = tone.effect === "rattle" ? a : 0,
    gu = tone.effect === "grunt" ? a : 0;
  const coefAt = (n: number) => C[Math.min(C.length - 1, Math.round(n / HOP))]!;

  // 1. Residual = the source, with the vowel filter removed.
  const e = new Float64Array(N);
  for (let n = 0; n < N; n++) {
    const c = coefAt(n);
    let acc = pre[n]!;
    for (let k = 1; k <= ORDER && n - k >= 0; k++) acc += c[k]! * pre[n - k]!;
    e[n] = acc;
  }

  // 2. Add effects at the source, locked to the singer's own pitch.
  const R = createRng(seed);
  const envK = 1 - Math.exp(-1 / (0.012 * SR));
  const e2 = new Float64Array(N);
  let pw = 0,
    phi = 0,
    lastK = -1,
    ampR = 1,
    vs = 0,
    creakNext = 0;
  let ratNext = Math.floor(0.03 * SR),
    ratLen = 0,
    ratPos = 1e9,
    ratAmp = 0,
    gate = 0,
    gT = 0,
    gNext = 0;
  for (let n = 0; n < N; n++) {
    const h = Math.min(an.f0.length - 1, Math.round(n / HOP));
    const f0 = an.f0[h] || 150;
    vs += ((an.voiced[h] ? 1 : 0) - vs) * 0.004;
    pw += (e[n]! * e[n]! - pw) * envK;
    const E = Math.sqrt(pw);
    phi += f0 / SR;
    const K = Math.floor(phi),
      frac = phi - K;
    if (K !== lastK) {
      ampR = 1 + 0.6 * d * (R() * 2 - 1);
      lastK = K;
    }
    const nz = R() * 2 - 1,
      half = 0.5 - 0.5 * Math.cos(Math.PI * phi);
    let mod = 1,
      add = 0;
    if (d > 0) {
      mod *= (1 - 0.4 * d * vs * half) * (1 + (ampR - 1) * vs);
      add += nz * E * 2.0 * d * vs * Math.exp(-frac * 5);
    }
    if (gr > 0) {
      mod *= 1 - 0.65 * gr * vs * half;
      add += nz * E * 1.6 * gr * vs * Math.exp(-frac * 3) * (K % 2 === 0 ? 1 : 0.25);
    }
    if (cr > 0) {
      mod *= 1 - 0.55 * cr * vs;
      if (n >= creakNext) {
        add += E * 14 * cr * vs * (0.5 + R());
        creakNext = n + Math.floor(SR / (22 + 40 * R()));
      }
    }
    if (ra > 0) {
      if (n >= ratNext) {
        ratLen = SR * (0.006 + 0.012 * R());
        ratAmp = 0.4 + 0.6 * R();
        ratPos = 0;
        ratNext = n + Math.floor(SR / (16 + 22 * R()));
      }
      if (ratPos < ratLen * 3) {
        const burst = Math.exp(-ratPos / (ratLen * 0.25));
        add += nz * E * 3.0 * ra * ratAmp * burst;
        mod *= 1 - 0.45 * ra * burst;
        ratPos++;
      }
    }
    if (gu > 0) {
      mod *= 1 - 0.75 * gu;
      if (n >= gNext) {
        gT = R();
        gNext = n + Math.floor(SR / (60 + 60 * R()));
      }
      gate += (gT - gate) * 0.02;
      add += nz * E * 2.6 * gu * (0.4 + 1.4 * gate);
    }
    if (air > 0) add += nz * E * 1.4 * air;
    e2[n] = e[n]! * mod + add;
  }

  // 3. Put the singer's vowel filter back on and undo pre-emphasis.
  const y = new Float64Array(N);
  for (let n = 0; n < N; n++) {
    const c = coefAt(n);
    let acc = e2[n]!;
    for (let k = 1; k <= ORDER && n - k >= 0; k++) acc -= c[k]! * y[n - k]!;
    y[n] = acc;
  }
  let out: Float32Array<ArrayBuffer> = new Float32Array(N);
  let prev = 0;
  for (let n = 0; n < N; n++) {
    prev = y[n]! + PRE_EMPHASIS * prev;
    out[n] = prev;
  }

  // 4. Tract handles as gentle EQ on top of the singer's own shape.
  const voice = tractOf(tone);
  const lar = voice.larynx / 100;
  out = applyBiquad(out, biquad("high", 2500, lar * 6 - gu * 6, 0.7, SR));
  out = applyBiquad(out, biquad("low", 300, -lar * 3 + gu * 3, 0.7, SR));
  if (voice.twang > 0) out = applyBiquad(out, biquad("peak", 3000, (voice.twang / 100) * 9, 1.1, SR));
  let x1 = 0,
    y1 = 0;
  for (let n = 0; n < N; n++) {
    const v = out[n]! - x1 + 0.995 * y1;
    x1 = out[n]!;
    y1 = v;
    out[n] = v;
  }
  return normalize(out);
}

/** Trim silence, cap length and normalise a decoded take. Returns null when it is too short. */
export function prepareTake(x: Float32Array, sampleRate: number, maxSeconds = 12): Float32Array | null {
  let y = x.length > maxSeconds * sampleRate ? x.slice(0, maxSeconds * sampleRate) : x;
  let pk = 1e-9;
  for (let i = 0; i < y.length; i++) pk = Math.max(pk, Math.abs(y[i]!));
  const th = pk * 0.03;
  let a = 0,
    b = y.length - 1;
  while (a < b && Math.abs(y[a]!) < th) a++;
  while (b > a && Math.abs(y[b]!) < th) b--;
  a = Math.max(0, a - Math.floor(sampleRate * 0.05));
  b = Math.min(y.length - 1, b + Math.floor(sampleRate * 0.08));
  y = normalize(y.slice(a, b + 1));
  if (y.length < sampleRate * 0.4) return null;
  const fade = Math.floor(sampleRate * 0.01);
  for (let i = 0; i < fade; i++) {
    y[i] = y[i]! * (i / fade);
    y[y.length - 1 - i] = y[y.length - 1 - i]! * (i / fade);
  }
  return y;
}
