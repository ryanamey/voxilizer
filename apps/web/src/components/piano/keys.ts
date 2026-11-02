import { PITCH_MAX, PITCH_MIN } from "@voxilizer/engine";

/** The singing range every keyboard in the app shows: C2 (deep bass) to C6 (high soprano). */
export const PIANO_LOW = PITCH_MIN;
export const PIANO_HIGH = PITCH_MAX;

const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const isBlack = (midi: number) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
export const keyName = (midi: number) => `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
