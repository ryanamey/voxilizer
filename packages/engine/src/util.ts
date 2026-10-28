const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"] as const;

/** MIDI pitch → frequency in Hz (A4 = 440). Accepts fractional pitches. */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** MIDI pitch → name such as "A3" or "C♯4". */
export function noteName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  return `${NOTE_NAMES[pc]}${Math.floor(midi / 12) - 1}`;
}

/** Deterministic pseudo-random generator (mulberry32) so renders are repeatable. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Coefficients of a second-order resonator (Klatt-style formant filter). */
export function resonatorCoefs(freq: number, bandwidth: number, sampleRate: number): [number, number, number] {
  const T = 1 / sampleRate;
  const c = -Math.exp(-2 * Math.PI * bandwidth * T);
  const b = 2 * Math.exp(-Math.PI * bandwidth * T) * Math.cos(2 * Math.PI * freq * T);
  return [1 - b - c, b, c];
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
