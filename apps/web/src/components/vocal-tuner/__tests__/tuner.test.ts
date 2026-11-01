import { describe, expect, it } from "vitest";
import {
  direction,
  distanceText,
  HOLD_MS,
  initialTuner,
  keyName,
  tunerStep,
  type TunerState,
} from "../tuner";

/** Feed a reading every 16 ms (about 60 per second). */
function sing(state: TunerState, midi: number | null, ms: number, target: number, tol = 25, from = 0) {
  let s = state;
  for (let t = from; t <= from + ms; t += 16) s = tunerStep(s, midi, t, target, tol);
  return s;
}

describe("tuner", () => {
  const C4 = 60,
    A4 = 69;

  it("shows a wrong note in real time and points toward the target", () => {
    const s = sing(initialTuner(0, true), A4, 100, C4);
    expect(s.status).toBe("wrong-note");
    expect(s.sungKey).toBe(A4);
    expect(direction(s, 25)).toBe(-1); // sing lower: arrow points left
    expect(distanceText(C4 - s.sungKey!)).toBe("9 semitones lower");
  });

  it("follows the voice as it moves", () => {
    let s = sing(initialTuner(0, true), A4, 100, C4);
    s = sing(s, 64, 100, C4, 25, 120);
    expect(s.sungKey).toBe(64);
  });

  it("locks only after the note is held in tune for 2 seconds", () => {
    let s = sing(initialTuner(0, true), C4 + 0.1, HOLD_MS - 100, C4);
    expect(s.status).toBe("holding");
    s = sing(s, C4 + 0.1, 200, C4, 25, HOLD_MS - 84);
    expect(s.status).toBe("locked");
  });

  it("restarts the count when the singer drifts off", () => {
    let s = sing(initialTuner(0, true), C4, 1500, C4);
    s = sing(s, C4 + 0.4, 400, C4, 25, 1516); // 40 cents sharp for 0.4 s
    expect(s.status).toBe("close");
    s = sing(s, C4, 1500, C4, 25, 1932);
    expect(s.status).toBe("holding");
  });

  it("forgives a short wobble or dropout", () => {
    let s = sing(initialTuner(0, true), C4, 1000, C4);
    s = sing(s, null, 80, C4, 25, 1016);
    s = sing(s, C4, 1100, C4, 25, 1112);
    expect(s.status).toBe("locked");
  });

  it("tells a wrong octave apart and goes silent when the voice stops", () => {
    let s = sing(initialTuner(0, true), 48, 100, C4);
    expect(s.status).toBe("wrong-octave");
    expect(direction(s, 25)).toBe(1);
    s = sing(s, null, 400, C4, 25, 120);
    expect(s.status).toBe("silent");
    expect(s.sungKey).toBeNull();
  });

  it("ignores a one-frame glitch", () => {
    let s = sing(initialTuner(0, true), C4, 500, C4);
    s = tunerStep(s, C4 - 12, 520, C4, 25);
    expect(s.sungKey).toBe(C4);
    s = tunerStep(s, C4, 536, C4, 25);
    expect(s.status).toBe("holding");
  });

  it("names keys", () => {
    expect(keyName(60)).toBe("C4");
    expect(keyName(24)).toBe("C1");
    expect(keyName(107)).toBe("B7");
    expect(keyName(70)).toBe("A♯4");
  });
});
