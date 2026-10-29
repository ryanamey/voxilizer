import {
  EFFECTS,
  MODES,
  midiToHz,
  noteName,
  SINGERS,
  VOLUME_LABEL,
  VOWELS,
  sungVowel,
  type Tone,
  type VoiceSettings,
} from "@voxilizer/engine";
import type { Preview, Source } from "./store";
import type { TakeInfo } from "@/audio/audio-engine";

export function hzToNoteName(hz: number): string {
  return noteName(Math.round(69 + 12 * Math.log2(hz / 440)));
}

function vowelText(vowel: Preview["vowel"], tone: Tone, pitch: number, voice: VoiceSettings): string {
  const sung = sungVowel(vowel, tone.mode, pitch, voice.singer);
  const name = (v: Preview["vowel"]) => `${v} (as in "${VOWELS[v].word}")`;
  return sung === vowel ? name(vowel) : `${name(vowel)}, sung as ${name(sung)}`;
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
      : `Mode: ${MODES[tone.mode].label}${tone.mode === "neutral" && tone.air ? ` with audible air ${tone.air}%` : ""}, volume ${tone.volume} (${VOLUME_LABEL[tone.volume]})\nNote: ${noteName(preview.pitch)} (${Math.round(
          midiToHz(preview.pitch),
        )} Hz), ${SINGERS[voice.singer].label.toLowerCase()} voice, vowel ${vowelText(preview.vowel, tone, preview.pitch, voice)}`;
  const effect =
    tone.effect === "none" ? "Effect: none" : `Effect: ${EFFECTS[tone.effect].label} ${tone.amount}%`;
  const larynx =
    voice.larynx === 0 ? "neutral" : `${voice.larynx > 0 ? "raised" : "lowered"} ${Math.abs(voice.larynx)}%`;
  return [
    carrier,
    effect,
    `Distortion: ${tone.ff ? `${tone.ff}%` : "off"}`,
    `Larynx: ${larynx} · Twang above necessary: ${voice.twang}%`,
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
