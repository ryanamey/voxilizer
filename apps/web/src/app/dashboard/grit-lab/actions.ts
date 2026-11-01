"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { SongSchema, type Song } from "@voxilizer/engine";
import { requireUser } from "@/lib/dal";
import * as songsRepo from "@/lib/songs";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const MAX_NOTES = 2000;
const idSchema = z.uuid();
const saveSchema = SongSchema.refine(
  (s) => s.notes.length <= MAX_NOTES,
  `A song can have at most ${MAX_NOTES} notes.`,
);

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

/** Create a new song, or update an existing one the user owns. Returns the song id. */
export async function saveSongAction(song: Song, id?: string | null): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = saveSchema.safeParse(song);
  if (!parsed.success) return fail("This song couldn't be saved because some of its data is invalid.");
  if (id && !idSchema.safeParse(id).success) return fail("That song could not be found.");

  try {
    if (id) {
      const updated = await songsRepo.updateSong(user.id, id, parsed.data);
      if (!updated) return fail("That song could not be found. It may have been deleted.");
      revalidatePath("/dashboard");
      return { ok: true, data: { id } };
    }
    const newId = await songsRepo.createSong(user.id, parsed.data);
    revalidatePath("/dashboard");
    return { ok: true, data: { id: newId } };
  } catch (err) {
    console.error("[songs] save failed:", err);
    return fail("Saving failed. Check your connection and try again.");
  }
}

export async function loadSongAction(id: string): Promise<ActionResult<{ id: string; song: Song }>> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail("That song could not be found.");
  try {
    const found = await songsRepo.getSong(user.id, id);
    return found ? { ok: true, data: found } : fail("That song could not be found.");
  } catch (err) {
    console.error("[songs] load failed:", err);
    return fail("Loading failed. Check your connection and try again.");
  }
}

export async function listSongsAction(): Promise<ActionResult<songsRepo.SongSummary[]>> {
  const user = await requireUser();
  try {
    return { ok: true, data: await songsRepo.listSongs(user.id) };
  } catch (err) {
    console.error("[songs] list failed:", err);
    return fail("Your songs couldn't be loaded. Check your connection and try again.");
  }
}

export async function deleteSongAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail("That song could not be found.");
  try {
    const deleted = await songsRepo.deleteSong(user.id, id);
    if (!deleted) return fail("That song could not be found.");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[songs] delete failed:", err);
    return fail("Deleting failed. Check your connection and try again.");
  }
}
