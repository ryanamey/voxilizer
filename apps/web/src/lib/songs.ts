import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { parseSong, type Song } from "@voxilizer/engine";
import { getDb } from "@/db";
import { songs } from "@/db/schema";

/**
 * Song data access. Every query is scoped to the owner's user id, so one user
 * can never read or change another user's songs.
 */
export interface SongSummary {
  id: string;
  title: string;
  updatedAt: Date;
  noteCount: number;
}

export async function listSongs(userId: string, limit = 50): Promise<SongSummary[]> {
  const rows = await getDb()
    .select({ id: songs.id, title: songs.title, updatedAt: songs.updatedAt, data: songs.data })
    .from(songs)
    .where(eq(songs.userId, userId))
    .orderBy(desc(songs.updatedAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt,
    noteCount: r.data.notes.length,
  }));
}

export async function getSong(userId: string, id: string): Promise<{ id: string; song: Song } | null> {
  const [row] = await getDb()
    .select()
    .from(songs)
    .where(and(eq(songs.id, id), eq(songs.userId, userId)))
    .limit(1);
  return row ? { id: row.id, song: parseSong(row.data) } : null;
}

export async function createSong(userId: string, song: Song): Promise<string> {
  const [row] = await getDb()
    .insert(songs)
    .values({ userId, title: song.title, data: song })
    .returning({ id: songs.id });
  if (!row) throw new Error("Failed to create song");
  return row.id;
}

export async function updateSong(userId: string, id: string, song: Song): Promise<boolean> {
  const rows = await getDb()
    .update(songs)
    .set({ title: song.title, data: song })
    .where(and(eq(songs.id, id), eq(songs.userId, userId)))
    .returning({ id: songs.id });
  return rows.length > 0;
}

export async function deleteSong(userId: string, id: string): Promise<boolean> {
  const rows = await getDb()
    .delete(songs)
    .where(and(eq(songs.id, id), eq(songs.userId, userId)))
    .returning({ id: songs.id });
  return rows.length > 0;
}
