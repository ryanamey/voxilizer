"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon, SlidersHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import type { Tone } from "@voxilizer/engine";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/grit-lab/controls";
import { toneFromLibrary, toneLabel, toneStatus, useToneLibrary } from "@/components/grit-lab/library";
import { useGritLab, type EditTarget } from "@/components/grit-lab/store";
import type { SavedTone } from "@/lib/validation/tones";
import { useMelody } from "./store";
import { TonePicker, toneSummary } from "./tone-picker";

/** Open a song's tone in Grit Lab, remembering where it should come back to. */
export function useEditInGritLab() {
  const router = useRouter();
  return (tone: Tone, target: EditTarget) => {
    const song = useMelody.getState().song;
    useGritLab.getState().openTone(tone, { singer: song.voice.singer, target });
    router.push("/dashboard/grit-lab");
  };
}

/** The song's main tone, the singer, and updates waiting in the tone library. */
export function SongTonePanel() {
  const song = useMelody((s) => s.song);
  const { tones, status, load } = useToneLibrary();
  const editInGritLab = useEditInGritLab();
  useEffect(() => void load(), [load]);
  const ready = status === "ready";
  const st = toneStatus(song.tone, tones, ready);

  // Library tones that changed since this song copied them.
  const outdated = useMemo(() => {
    const found = new Map<string, { lib: SavedTone; uses: number }>();
    for (const t of [song.tone, ...song.notes.map((n) => n.tone)]) {
      if (!t) continue;
      const s = toneStatus(t, tones, ready);
      if (s.kind !== "outdated") continue;
      const e = found.get(s.tone.id) ?? { lib: s.tone, uses: 0 };
      e.uses++;
      found.set(s.tone.id, e);
    }
    return [...found.values()];
  }, [song, tones, ready]);

  return (
    <section
      aria-labelledby="song-tone-heading"
      className="flex flex-col gap-4 rounded-xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            id="song-tone-heading"
            className="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
          >
            Song tone
          </h2>
          <p className="text-lg font-semibold">{toneLabel(song.tone, tones, ready)}</p>
          <p className="text-sm text-muted-foreground">
            {toneSummary(song.tone)}. Every note uses it unless you give the note its own tone.
          </p>
          {st.kind === "deleted" && (
            <p className="text-xs text-muted-foreground">
              Its library tone was deleted; this song keeps its own copy.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TonePicker
            label="Change song tone"
            onPick={(t) => {
              if (!t) return;
              useMelody.getState().setSongTone(t);
              toast.success(`Song tone: ${t.origin?.name ?? "the Grit Lab design"}`);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => editInGritLab(song.tone, { kind: "song", songTitle: song.title })}
          >
            <SlidersHorizontalIcon /> Edit in Grit Lab
          </Button>
          <Segmented
            label="Singer"
            size="sm"
            value={song.voice.singer}
            options={[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ]}
            onChange={(singer) => useMelody.getState().setSinger(singer)}
          />
        </div>
      </div>

      {outdated.map(({ lib, uses }) => (
        <div
          key={lib.id}
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm"
        >
          <RefreshCwIcon className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="font-medium">{lib.name}</span> changed in your library since this song used it (
            {uses === 1 ? "1 place" : `${uses} places`}).
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              useMelody.getState().updateFromLibrary(lib.id, toneFromLibrary(lib));
              toast.success(`Updated to the new ${lib.name}`);
            }}
          >
            Update this song
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            // Keep the old sound: it becomes an adjusted copy of the new library version.
            onClick={() => useMelody.getState().keepVersion(lib.id, lib.savedAt)}
          >
            Keep this version
          </Button>
        </div>
      ))}
    </section>
  );
}
