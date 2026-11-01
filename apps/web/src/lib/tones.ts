import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tones } from "@/db/schema";
import { SavedToneDataSchema, type SavedTone, type SavedToneData } from "@/lib/validation/tones";

/**
 * Tone library data access. Every query is scoped to the owner's user id, so one user can never
 * read or change another user's tones.
 */
const MAX_TONES = 200;

function toSaved(row: typeof tones.$inferSelect): SavedTone | null {
  const data = SavedToneDataSchema.safeParse(row.data);
  return data.success
    ? { id: row.id, name: row.name, data: data.data, savedAt: row.updatedAt.toISOString() }
    : null;
}

export async function listTones(userId: string): Promise<SavedTone[]> {
  const rows = await getDb()
    .select()
    .from(tones)
    .where(eq(tones.userId, userId))
    .orderBy(desc(tones.updatedAt))
    .limit(MAX_TONES);
  return rows.map(toSaved).filter((t): t is SavedTone => t !== null);
}

export async function countTones(userId: string): Promise<number> {
  const rows = await getDb().select({ id: tones.id }).from(tones).where(eq(tones.userId, userId));
  return rows.length;
}

export async function createTone(userId: string, name: string, data: SavedToneData): Promise<SavedTone> {
  const [row] = await getDb().insert(tones).values({ userId, name, data }).returning();
  const saved = row && toSaved(row);
  if (!saved) throw new Error("Failed to create tone");
  return saved;
}

export async function updateTone(
  userId: string,
  id: string,
  name: string,
  data: SavedToneData,
): Promise<SavedTone | null> {
  const [row] = await getDb()
    .update(tones)
    .set({ name, data })
    .where(and(eq(tones.id, id), eq(tones.userId, userId)))
    .returning();
  return row ? toSaved(row) : null;
}

export async function deleteTone(userId: string, id: string): Promise<boolean> {
  const rows = await getDb()
    .delete(tones)
    .where(and(eq(tones.id, id), eq(tones.userId, userId)))
    .returning({ id: tones.id });
  return rows.length > 0;
}

export { MAX_TONES };
