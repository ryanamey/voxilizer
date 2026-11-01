"use server";

import { z } from "zod";
import { requireUser } from "@/lib/dal";
import * as tonesRepo from "@/lib/tones";
import { SavedToneDataSchema, toneNameSchema, type SavedTone } from "@/lib/validation/tones";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const idSchema = z.uuid();
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** The signed-in singer's tone library, newest first. */
export async function listTonesAction(): Promise<ActionResult<SavedTone[]>> {
  const user = await requireUser();
  try {
    return { ok: true, data: await tonesRepo.listTones(user.id) };
  } catch (err) {
    console.error("[tones] list failed:", err);
    return fail("Your tones couldn't be loaded. Check your connection and try again.");
  }
}

/** Save a new tone, or overwrite one the user owns when `id` is given. */
export async function saveToneAction(
  name: unknown,
  data: unknown,
  id?: string | null,
): Promise<ActionResult<SavedTone>> {
  const user = await requireUser();
  const parsedName = toneNameSchema.safeParse(name);
  if (!parsedName.success) return fail(parsedName.error.issues[0]?.message ?? "Check the tone's name.");
  const parsedData = SavedToneDataSchema.safeParse(data);
  if (!parsedData.success)
    return fail("This tone couldn't be saved because some of its settings are invalid.");
  if (id && !idSchema.safeParse(id).success) return fail("That tone could not be found.");

  try {
    if (id) {
      const updated = await tonesRepo.updateTone(user.id, id, parsedName.data, parsedData.data);
      return updated
        ? { ok: true, data: updated }
        : fail("That tone could not be found. It may have been deleted.");
    }
    if ((await tonesRepo.countTones(user.id)) >= tonesRepo.MAX_TONES)
      return fail(`Your library is full (${tonesRepo.MAX_TONES} tones). Delete some to save new ones.`);
    return { ok: true, data: await tonesRepo.createTone(user.id, parsedName.data, parsedData.data) };
  } catch (err) {
    console.error("[tones] save failed:", err);
    return fail("Saving failed. Check your connection and try again.");
  }
}

export async function deleteToneAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail("That tone could not be found.");
  try {
    return (await tonesRepo.deleteTone(user.id, id))
      ? { ok: true, data: undefined }
      : fail("That tone could not be found.");
  } catch (err) {
    console.error("[tones] delete failed:", err);
    return fail("Deleting failed. Check your connection and try again.");
  }
}
