/** In-place radix-2 FFT (re/im of power-of-two length). */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len,
      wr = Math.cos(ang),
      wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1,
        ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j,
          b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci,
          ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const nc = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nc;
      }
    }
  }
}

/**
 * Magnitude spectrum in dB (0 dB = loudest bin) from `start`, Hann-windowed,
 * up to `maxHz`. Returns one value per FFT bin.
 */
export function magnitudeSpectrum(
  x: Float32Array,
  sampleRate: number,
  start: number,
  size = 8192,
  maxHz = 3000,
): { db: Float32Array; binHz: number } {
  const re = new Float64Array(size),
    im = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    const v = x[start + i] ?? 0;
    re[i] = v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  fft(re, im);
  const binHz = sampleRate / size;
  const bins = Math.min(size / 2, Math.floor(maxHz / binHz));
  const mag = new Float32Array(bins);
  let peak = 1e-12;
  for (let i = 1; i < bins; i++) {
    mag[i] = Math.hypot(re[i]!, im[i]!);
    peak = Math.max(peak, mag[i]!);
  }
  const db = new Float32Array(bins);
  for (let i = 0; i < bins; i++) db[i] = 20 * Math.log10(mag[i]! / peak + 1e-12);
  return { db, binHz };
}
