import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Song } from "@voxilizer/engine";

/**
 * Application tables. Users, sessions and accounts are managed by Neon Auth in
 * the `neon_auth` schema; we reference users by their id and never write there.
 */

/** A melody designed in Grit Lab. `data` holds the versioned Song JSON from @voxilizer/engine. */
export const songs = pgTable(
  "songs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    data: jsonb("data").$type<Song>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("songs_user_updated_idx").on(t.userId, t.updatedAt)],
);

export type SongRow = typeof songs.$inferSelect;
