import {
  EFFECTS,
  MODES,
  midiToHz,
  noteName,
  VOICES,
  VOWELS,
  type Tone,
  type VoiceSettings,
} from "@voxilizer/engine";
import type { Preview, Source } from "./store";
import type { TakeInfo } from "@/audio/audio-engine";

export function hzToNoteName(hz: number): string {
  return noteName(Math.round(69 + 12 * Math.log2(hz / 440)));
}

/** A copyable, plain-text description of the designed tone. */
export function recipeText(
  tone: Tone,
  voice: VoiceSettings,
  preview: Preview,
  source: Source,
  take: TakeInfo | null,
): string {
  const carrier =
    source === "mine"
      ? take?.medianF0
        ? `Carrier: your recording, ${hzToNoteName(take.medianF0)} (${Math.round(take.medianF0)} Hz)`
        : "Carrier: your recording (no take yet)"
      : `Carrier: ${MODES[tone.mode].label} on ${preview.vowel} (${VOWELS[preview.vowel].hint}), ${noteName(preview.pitch)} (${Math.round(
          midiToHz(preview.pitch),
        )} Hz), ${VOICES[voice.voice].label.toLowerCase()} voice`;
  const effect =
    tone.effect === "none" ? "Effect: none" : `Effect: ${EFFECTS[tone.effect].label} ${tone.amount}%`;
  const larynx =
    voice.larynx === 0 ? "neutral" : `${voice.larynx > 0 ? "raised" : "lowered"} ${Math.abs(voice.larynx)}%`;
  return [
    carrier,
    effect,
    `False-fold distortion: ${tone.ff ? `${tone.ff}%` : "off"}`,
    `Larynx: ${larynx} · Twang: ${voice.twang}% · Air: ${voice.air}%`,
  ].join("\n");
}

export const STAGE_INFO = {
  0: {
    name: "Foundations and a clean carrier",
    gate: "Pass all six foundation tests: breath, retraction, clean onsets, carrier, isolation, release.",
  },
  1: {
    name: "True-fold texture",
    gate: "Creak and air switch on and off effortlessly; voice clear the next morning.",
  },
  2: {
    name: "False-fold family",
    gate: "Distortion goes on and off without the clean note changing pitch or vowel.",
  },
  3: {
    name: "Aryepiglottic family",
    gate: "The effect sits on a clean mid-low note at low volume, with no pain or hoarseness after.",
  },
  4: {
    name: "Integration",
    gate: "Each source passes on its own before they are stacked or pushed to high amounts.",
  },
} as const;
