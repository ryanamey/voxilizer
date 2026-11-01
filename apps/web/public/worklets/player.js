/**
 * Voxilizer playback worklet. Runs on the browser's audio thread.
 *
 * Messages in (port):
 *   { type: "play", samples: Float32Array, id: number }  start a buffer from the top
 *   { type: "stop" }                                      stop immediately
 *   { type: "release", seconds }                          fade out, then stop (a key let go)
 * Messages out:
 *   { type: "position", id, seconds }  ~30 times a second while playing
 *   { type: "ended", id }              buffer finished or was stopped
 *
 * Kept as plain JS in /public because addModule() needs a URL to a script.
 * It has no dependencies: the engine renders in a Web Worker, this only plays.
 */
class VoxPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = null;
    this.pos = 0;
    this.id = 0;
    this.sinceReport = 0;
    this.reportEvery = Math.floor(sampleRate / 30);
    // Fades avoid clicks: the previous buffer crossfades out when a new one starts, and a
    // released key fades out instead of stopping dead.
    this.old = null;
    this.oldPos = 0;
    this.oldGain = 0;
    this.oldStep = 1 / Math.max(1, Math.floor(sampleRate * 0.008));
    this.gain = 1;
    this.fadeStep = 0;
    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === "play") {
        if (this.buf) {
          this.port.postMessage({ type: "ended", id: this.id });
          this.old = this.buf;
          this.oldPos = this.pos;
          this.oldGain = this.gain;
        }
        this.buf = msg.samples;
        this.pos = 0;
        this.gain = 1;
        this.fadeStep = 0;
        this.id = msg.id;
        this.sinceReport = this.reportEvery;
      } else if (msg.type === "release" && this.buf) {
        this.fadeStep = 1 / Math.max(1, Math.floor(sampleRate * (msg.seconds || 0.12)));
      } else if (msg.type === "stop" && this.buf) {
        this.buf = null;
        this.port.postMessage({ type: "ended", id: this.id });
      }
    };
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length === 0) return true;
    const ch0 = out[0];
    const frames = ch0.length;
    if (!this.buf && !this.old) {
      for (let c = 0; c < out.length; c++) out[c].fill(0);
      return true;
    }
    for (let i = 0; i < frames; i++) {
      let v = 0;
      if (this.buf) {
        v = (this.pos < this.buf.length ? this.buf[this.pos] : 0) * this.gain;
        this.pos++;
        if (this.fadeStep) this.gain = Math.max(0, this.gain - this.fadeStep);
      }
      if (this.old) {
        v += (this.oldPos < this.old.length ? this.old[this.oldPos] : 0) * this.oldGain;
        this.oldPos++;
        this.oldGain -= this.oldStep;
        if (this.oldGain <= 0) this.old = null;
      }
      for (let c = 0; c < out.length; c++) out[c][i] = v;
    }
    if (!this.buf) return true;
    this.sinceReport += frames;
    if (this.sinceReport >= this.reportEvery) {
      this.sinceReport = 0;
      this.port.postMessage({ type: "position", id: this.id, seconds: this.pos / sampleRate });
    }
    if (this.pos >= this.buf.length || (this.fadeStep && this.gain <= 0)) {
      this.buf = null;
      this.port.postMessage({ type: "ended", id: this.id });
    }
    return true;
  }
}

registerProcessor("vox-player", VoxPlayer);
