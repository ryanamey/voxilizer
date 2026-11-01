import { z } from "zod";
import { SINGER_IDS, ToneSchema, VOWEL_IDS } from "@voxilizer/engine";

/** What a library tone stores: the sound, plus the singer and preview note it was designed on. */
export const SavedToneDataSchema = z.object({
  version: z.literal(1),
  tone: ToneSchema.omit({ origin: true }),
  singer: z.enum(SINGER_IDS),
  preview: z.object({ vowel: z.enum(VOWEL_IDS), pitch: z.number().int().min(24).max(108) }),
});
export type SavedToneData = z.infer<typeof SavedToneDataSchema>;

export const toneNameSchema = z
  .string()
  .trim()
  .min(1, "Give the tone a name.")
  .max(60, "Use 60 characters or fewer.");

/** A tone as the browser sees it. `savedAt` is the ISO time of the last save. */
export interface SavedTone {
  id: string;
  name: string;
  data: SavedToneData;
  savedAt: string;
}
