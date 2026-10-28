/**
 * Voxilizer playback worklet. Runs on the browser's audio thread.
 *
 * Messages in (port):
 *   { type: "play", samples: Float32Array, id: number }  start a buffer from the top
 *   { type: "stop" }                                      stop immediately
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
    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === "play") {
        if (this.buf) this.port.postMessage({ type: "ended", id: this.id });
        this.buf = msg.samples;
        this.pos = 0;
        this.id = msg.id;
        this.sinceReport = this.reportEvery;
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
    if (!this.buf) {
      for (let c = 0; c < out.length; c++) out[c].fill(0);
      return true;
    }
    for (let i = 0; i < frames; i++) {
      const v = this.pos < this.buf.length ? this.buf[this.pos] : 0;
      for (let c = 0; c < out.length; c++) out[c][i] = v;
      this.pos++;
    }
    this.sinceReport += frames;
    if (this.sinceReport >= this.reportEvery) {
      this.sinceReport = 0;
      this.port.postMessage({ type: "position", id: this.id, seconds: this.pos / sampleRate });
    }
    if (this.pos >= this.buf.length) {
      this.buf = null;
      this.port.postMessage({ type: "ended", id: this.id });
    }
    return true;
  }
}

registerProcessor("vox-player", VoxPlayer);
