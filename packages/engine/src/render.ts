/**
 * Melody renderer: time-varying source–filter synthesis.
 *
 * Source: a Rosenberg-style glottal pulse per cycle (shape set by the carrier mode),
 *   plus added sources for each effect (false-fold noise bursts, growl sub-harmonic
 *   flutter, creak pulse drops, rattle bursts, grunt turbulence) and aspiration.
 * Filter: five cascaded formant resonators (vowel × voice × larynx × twang)
 *   plus a parallel ~3 kHz "ring" resonator.
 * Control parameters are computed per block of BLOCK samples and glide between
 *   notes, so pitch, vowels and effects move smoothly like a sung line.
 *
 * Ported from the Grit Lab prototype; behaviour must stay equivalent until a
 * deliberate sound change is made.
 */
import { MODES, SINGERS, VOWELS } from "./constants";
import type { Note, Tone, VoiceSettings } from "./song";
import { STEPS_PER_BEAT } from "./song";
import { createRng, midiToHz, resonatorCoefs } from "./util";

export const DEFAULT_SAMPLE_RATE = 44100;
const BLOCK = 64;
const TAIL_SECONDS = 0.45;

export interface RenderOptions {
  tempo: number;
  songTone: Tone;
  voice: VoiceSettings;
  sampleRate?: number;
  /** Seed for the noise generator; same inputs + seed = identical output. */
  seed?: number;
}

export interface RenderResult {
  samples: Float32Array;
  sampleRate: number;
  /** Seconds per grid step, for mapping playback time to the piano roll. */
  secondsPerStep: number;
}

interface Target {
  midi: number;
  oq: number;
  cl: number;
  tilt: number;
  gain: number;
  asp: number;
  cr: number;
  gr: number;
  ra: number;
  gu: number;
  d: number;
  ring: number;
  vol: number;
  F: number[];
  BW: number[];
}

type Smoothed = Omit<Target, "F" | "BW"> & { amp: number; F: number[]; BW: number[] };
const SCALAR_KEYS = ["oq", "cl", "tilt", "gain", "asp", "cr", "gr", "ra", "gu", "d", "ring", "vol"] as const;

/** Output level for a CVT volume: 10 = full scale, each step ≈ 2.2 dB quieter. */
export function volumeGain(volume: number): number {
  return Math.pow(10, (-(10 - volume) * 2.2) / 20);
}

function targetFor(note: Note, songTone: Tone, voice: VoiceSettings): Target {
  const q = note.tone ?? songTone;
  const m = MODES[q.mode];
  const a = q.effect === "none" ? 0 : q.amount / 100;
  const gu = q.effect === "grunt" ? a : 0;
  const tw = voice.twang / 100;
  const vs = SINGERS[voice.singer].scale * (1 + 0.11 * (voice.larynx / 100)) * (1 - 0.08 * gu);
  const base = VOWELS[note.vowel].formants;
  const F = [base[0] * m.f1, base[1], base[2], 3350, 4000].map((f) => f * vs);
  F[2] = F[2]! + (2900 * vs - F[2]!) * tw * 0.5;
  F[3] = F[3]! + (3150 * vs - F[3]!) * tw * 0.5;
  // Louder singing closes the folds more firmly and brightens the spectrum.
  const loud = (q.volume - 6) / 4;
  // CVT: audible air belongs to Neutral only.
  const air = q.mode === "neutral" ? q.air / 100 : 0;
  return {
    midi: note.pitch,
    oq: Math.min(0.85, Math.max(0.3, m.oq - 0.04 * loud + 0.05 * air)),
    cl: m.cl,
    tilt: Math.min(0.9, Math.max(0, m.tilt - 0.08 * loud + 0.1 * air)),
    gain: m.gain,
    asp: m.asp + air * 0.55 + gu * 0.9,
    cr: q.effect === "creak" ? a : 0,
    gr: q.effect === "growl" ? a : 0,
    ra: q.effect === "rattle" ? a : 0,
    gu,
    d: q.ff / 100,
    ring: (m.ring + tw * 0.8) * 0.15,
    vol: q.volume,
    F,
    BW: [80, 90, 120 - 50 * tw, 150 - 60 * tw, 200],
  };
}

/** Render a list of notes to mono audio. Returns null when there are no notes. */
export function renderMelody(notes: readonly Note[], opts: RenderOptions): RenderResult | null {
  const SR = opts.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const sorted = [...notes].sort((a, b) => a.start - b.start);
  const last = sorted.at(-1);
  if (!last) return null;

  const spb = 60 / opts.tempo / STEPS_PER_BEAT;
  const dur = (last.start + last.length) * spb + TAIL_SECONDS;
  const N = Math.floor(dur * SR);
  const nb = Math.ceil(N / BLOCK) + 1;

  // ---- per-block control tracks ----
  const k = {
    midi: new Float32Array(nb),
    amp: new Float32Array(nb),
    oq: new Float32Array(nb),
    cl: new Float32Array(nb),
    tilt: new Float32Array(nb),
    gain: new Float32Array(nb),
    asp: new Float32Array(nb),
    cr: new Float32Array(nb),
    gr: new Float32Array(nb),
    ra: new Float32Array(nb),
    gu: new Float32Array(nb),
    d: new Float32Array(nb),
    ring: new Float32Array(nb),
    vol: new Float32Array(nb),
  };
  const bF = new Float32Array(nb * 5);
  const bBW = new Float32Array(nb * 5);

  const smooth = (tau: number) => 1 - Math.exp(-BLOCK / (SR * tau));
  const kPitch = smooth(0.03),
    kForm = smooth(0.045),
    kEff = smooth(0.05),
    kAtk = smooth(0.02),
    kRel = smooth(0.045);

  let cur: Smoothed | null = null;
  let idx = 0;
  let prevNote: Note | null = null;
  for (let b = 0; b < nb; b++) {
    const t = (b * BLOCK) / SR;
    while (idx < sorted.length && (sorted[idx]!.start + sorted[idx]!.length) * spb <= t) idx++;
    const cand = sorted[idx];
    const n = cand && cand.start * spb <= t ? cand : null;
    const tg = n ? targetFor(n, opts.songTone, opts.voice) : null;
    let ampT = n ? 1 : 0;
    // Re-articulate repeated pitches with a short dip.
    if (
      n &&
      prevNote &&
      prevNote !== n &&
      prevNote.start + prevNote.length === n.start &&
      prevNote.pitch === n.pitch &&
      t - n.start * spb < 0.03
    )
      ampT = 0.45;

    if (!cur && tg) cur = { ...tg, F: tg.F.slice(), BW: tg.BW.slice(), amp: 0 };
    if (cur && tg) {
      const fresh = cur.amp < 0.03;
      cur.midi = fresh ? tg.midi : cur.midi + (tg.midi - cur.midi) * kPitch;
      for (const key of SCALAR_KEYS) cur[key] = fresh ? tg[key] : cur[key] + (tg[key] - cur[key]) * kEff;
      for (let r = 0; r < 5; r++) {
        cur.F[r] = fresh ? tg.F[r]! : cur.F[r]! + (tg.F[r]! - cur.F[r]!) * kForm;
        cur.BW[r] = tg.BW[r]!;
      }
    }
    if (cur) {
      cur.amp += (ampT - cur.amp) * (ampT > cur.amp ? kAtk : kRel);
      let vib = 0;
      if (n) {
        const held = t - n.start * spb;
        vib = 0.2 * Math.max(0, Math.min(1, (held - 0.35) / 0.3)) * Math.sin(2 * Math.PI * 5.3 * t);
      }
      k.midi[b] = cur.midi + vib;
      k.amp[b] = cur.amp;
      for (const key of SCALAR_KEYS) k[key][b] = cur[key];
      for (let r = 0; r < 5; r++) {
        bF[b * 5 + r] = cur.F[r]!;
        bBW[b * 5 + r] = cur.BW[r]!;
      }
    } else {
      k.midi[b] = 57;
      k.vol[b] = 10;
      for (let r = 0; r < 5; r++) {
        bF[b * 5 + r] = 1000 * (r + 1);
        bBW[b * 5 + r] = 100;
      }
    }
    if (n) prevNote = n;
  }

  // ---- glottal source, cycle by cycle ----
  const R = createRng(opts.seed ?? 23);
  const flow = new Float32Array(N + 4000);
  const extra = new Float32Array(N + 4000);
  let pos = 0;
  let cycle = 0;
  while (pos < N) {
    const b = Math.floor(pos / BLOCK);
    const amp0 = k.amp[b]!,
      d = k.d[b]!,
      gr = k.gr[b]!,
      cr = k.cr[b]!,
      gu = k.gu[b]!;
    let T = (SR / midiToHz(k.midi[b]!)) * (1 + (0.004 + d * 0.025 + gr * 0.01 + gu * 0.035) * (R() * 2 - 1));
    let amp = amp0 * (1 + (0.03 + d * 0.3 + gu * 0.2) * (R() * 2 - 1));
    let oq = k.oq[b]!,
      cl = k.cl[b]!;
    if (cr > 0 && R() < 0.75 * cr) {
      T *= 1.5 + 1.6 * R();
      oq = 0.22;
      cl = 0.3;
      amp *= 0.6 + 0.7 * R();
    }
    if (gr > 0 && cycle % 2) {
      amp *= 1 - 0.55 * gr;
      T *= 1 + 0.05 * gr;
    }
    if (d > 0 && cycle % 2) amp *= 1 - 0.3 * d;
    if (gu > 0) {
      amp *= 1 - 0.7 * gu;
      oq = oq + (0.85 - oq) * gu;
    }
    const L = Math.max(8, Math.round(T));
    const tp = oq * (1 - cl) * L;
    const tn = Math.max(2, oq * cl * L);
    if (amp0 > 0.002) {
      for (let j = 0; j < L && pos + j < N; j++) {
        const v =
          j < tp
            ? 0.5 * (1 - Math.cos((Math.PI * j) / tp))
            : j < tp + tn
              ? Math.cos((Math.PI / 2) * ((j - tp) / tn))
              : 0;
        flow[pos + j] = amp * v;
      }
      if (d > 0) {
        // false folds: noisy burst after each closure
        const len = Math.round(L * 0.45),
          g = 0.9 * d * (0.4 + R()) * amp0,
          s0 = pos + Math.round(tp + tn);
        for (let j = 0; j < len && s0 + j < N; j++)
          extra[s0 + j]! += g * (R() * 2 - 1) * Math.exp(-j / (len * 0.3));
      }
      if (gr > 0 && cycle % 2 === 0) {
        // growl: flutter every other cycle → sub-harmonic
        const len = Math.round(L * 1.2),
          g = 0.7 * gr * amp0 * (0.6 + 0.8 * R()),
          s0 = pos + Math.round(tp);
        for (let j = 0; j < len && s0 + j < N; j++)
          extra[s0 + j]! +=
            g *
            (R() * 2 - 1) *
            Math.exp(-j / (len * 0.35)) *
            (0.5 + 0.5 * Math.sin((2 * Math.PI * j) / (len * 0.5)));
      }
    }
    pos += L;
    cycle++;
  }

  // ---- rattle: irregular wet bursts ----
  let t = 0.03;
  while (t < dur) {
    t += 1 / (16 + 22 * R());
    const s0 = Math.floor(t * SR);
    const b = Math.min(nb - 1, Math.floor(s0 / BLOCK));
    const ra = k.ra[b]! * k.amp[b]!;
    if (ra <= 0.01) continue;
    const len = Math.floor(SR * (0.006 + 0.012 * R())),
      g = 1.4 * ra * (0.4 + 0.6 * R());
    for (let j = 0; j < len && s0 + j < N; j++)
      extra[s0 + j]! += g * (R() * 2 - 1) * Math.exp(-j / (len * 0.25));
    if (s0 < N) extra[s0]! += g * 1.5;
  }

  // ---- filter: source → 5 formants (+ ring) → DC block ----
  const y = new Float32Array(N);
  const st = new Float64Array(12);
  const co = new Float64Array(15);
  const vsBase = SINGERS[opts.voice.singer].scale * (1 + 0.11 * (opts.voice.larynx / 100));
  const ringC = resonatorCoefs(3000 * vsBase, 260, SR);
  let prev = 0,
    lp = 0,
    gate = 0,
    gT = 0,
    gNext = 0,
    x1 = 0,
    y1 = 0,
    peak = 1e-6;
  for (let n = 0; n < N; n++) {
    const b = Math.floor(n / BLOCK);
    if (n % BLOCK === 0) {
      for (let r = 0; r < 5; r++) {
        const c = resonatorCoefs(Math.min(bF[b * 5 + r]!, SR * 0.45), bBW[b * 5 + r]!, SR);
        co[r * 3] = c[0];
        co[r * 3 + 1] = c[1];
        co[r * 3 + 2] = c[2];
      }
    }
    const df = (flow[n]! - prev) * 30 * k.gain[b]!;
    prev = flow[n]!;
    let noise = (R() * 2 - 1) * k.asp[b]! * (0.25 + flow[n]!) * 0.6 * Math.min(1, k.amp[b]! * 1.5);
    const gu = k.gu[b]!;
    if (gu > 0) {
      if (n >= gNext) {
        gT = R();
        gNext = n + Math.floor(SR / (60 + 60 * R()));
      }
      gate += (gT - gate) * 0.02;
      noise *= 0.4 + 1.4 * gate;
    }
    const tilt = k.tilt[b]!;
    lp = (df + noise + extra[n]! * 0.5) * (1 - tilt) + tilt * lp;
    let v = lp;
    for (let r = 0; r < 5; r++) {
      const o = co[r * 3]! * v + co[r * 3 + 1]! * st[r * 2]! + co[r * 3 + 2]! * st[r * 2 + 1]!;
      st[r * 2 + 1] = st[r * 2]!;
      st[r * 2] = o;
      v = o;
    }
    const ro = ringC[0] * v + ringC[1] * st[10]! + ringC[2] * st[11]!;
    st[11] = st[10]!;
    st[10] = ro;
    const xo = v + k.ring[b]! * ro;
    const out = xo - x1 + 0.995 * y1;
    x1 = xo;
    y1 = out;
    y[n] = out;
    peak = Math.max(peak, Math.abs(out));
  }

  // ---- gentle levelling (like a vocal compressor) and normalisation ----
  let env = 0,
    gs = 1;
  const ke = 1 - Math.exp(-1 / (0.08 * SR)),
    kg = 1 - Math.exp(-1 / (0.05 * SR));
  for (let n = 0; n < N; n++) {
    env += (y[n]! * y[n]! - env) * ke;
    const rms = Math.sqrt(env);
    const b = Math.floor(n / BLOCK);
    const want =
      k.amp[b]! > 0.2 && rms > peak * 0.005
        ? Math.max(0.35, Math.min(4, Math.pow((peak * 0.3) / rms, 0.65)))
        : gs;
    gs += (want - gs) * kg;
    y[n] = y[n]! * gs;
  }
  // Normalise the levelled signal, then apply each note's volume (volume 10 peaks at 0.85).
  let pk = 1e-6;
  for (let n = 0; n < N; n++) pk = Math.max(pk, Math.abs(y[n]!));
  const g = 0.85 / pk;
  for (let n = 0; n < N; n++) y[n] = y[n]! * g * volumeGain(k.vol[Math.floor(n / BLOCK)]!);

  return { samples: y, sampleRate: SR, secondsPerStep: spb };
}

/** Render one sustained note: the quick preview used by the tone designer. */
export function renderTone(
  tone: Tone,
  vowel: Note["vowel"],
  pitch: number,
  voice: VoiceSettings,
  seconds = 2.2,
  sampleRate = DEFAULT_SAMPLE_RATE,
): RenderResult {
  const tempo = 60;
  const steps = Math.max(1, Math.round(seconds / (60 / tempo / STEPS_PER_BEAT)));
  const note: Note = { id: "preview", pitch, start: 0, length: steps, vowel, tone };
  // A single note always yields a result.
  return renderMelody([note], { tempo, songTone: tone, voice, sampleRate })!;
}
