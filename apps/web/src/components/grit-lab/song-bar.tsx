"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlusIcon, FolderOpenIcon, Redo2Icon, SaveIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "zustand";
import {
  deleteSongAction,
  listSongsAction,
  loadSongAction,
  saveSongAction,
} from "@/app/dashboard/grit-lab/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useGritLab, useIsDirty } from "./store";

type SongSummary = { id: string; title: string; updatedAt: Date; noteCount: number };
const dateFmt = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Title, new/open/save and undo/redo for the song being edited. */
export function SongBar() {
  const router = useRouter();
  const title = useGritLab((s) => s.song.title);
  const songId = useGritLab((s) => s.songId);
  const dirty = useIsDirty();
  const canUndo = useStore(useGritLab.temporal, (t) => t.pastStates.length > 0);
  const canRedo = useStore(useGritLab.temporal, (t) => t.futureStates.length > 0);
  const [saving, startSave] = useTransition();
  const [openList, setOpenList] = useState(false);
  const [songs, setSongs] = useState<SongSummary[] | null>(null);
  const [confirm, setConfirm] = useState<null | { label: string; run: () => void }>(null);

  // Open ?song=<id> (links from the dashboard overview). Read on mount rather than with
  // useSearchParams, so the editor can render in the page's static shell.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("song");
    if (!requested || requested === useGritLab.getState().songId) return;
    void loadSongAction(requested).then((r) => {
      if (r.ok) useGritLab.getState().loadSong(r.data.song, r.data.id);
      else toast.error(r.error);
    });
  }, []);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Undo / redo shortcuts (not while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey) || (e.key.toLowerCase() !== "z" && e.key.toLowerCase() !== "y")) return;
      e.preventDefault();
      const redo = e.key.toLowerCase() === "y" || e.shiftKey;
      if (redo) useGritLab.temporal.getState().redo();
      else useGritLab.temporal.getState().undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function guard(label: string, run: () => void) {
    if (useGritLab.getState().song.notes.length && dirty) setConfirm({ label, run });
    else run();
  }

  function save() {
    startSave(async () => {
      const { song, songId: id } = useGritLab.getState();
      const r = await saveSongAction(song, id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      useGritLab.getState().markSaved(r.data.id);
      if (new URLSearchParams(window.location.search).get("song") !== r.data.id)
        router.replace(`/dashboard/grit-lab?song=${r.data.id}`, { scroll: false });
      toast.success("Song saved");
    });
  }

  async function showOpen() {
    setOpenList(true);
    setSongs(null);
    const r = await listSongsAction();
    if (r.ok) setSongs(r.data);
    else {
      toast.error(r.error);
      setOpenList(false);
    }
  }

  async function open(id: string) {
    const r = await loadSongAction(id);
    if (!r.ok) return toast.error(r.error);
    useGritLab.getState().loadSong(r.data.song, r.data.id);
    router.replace(`/dashboard/grit-lab?song=${id}`, { scroll: false });
    setOpenList(false);
  }

  async function remove(id: string) {
    const r = await deleteSongAction(id);
    if (!r.ok) return toast.error(r.error);
    setSongs((list) => list?.filter((s) => s.id !== id) ?? null);
    if (useGritLab.getState().songId === id) {
      useGritLab.getState().newSong();
      router.replace("/dashboard/grit-lab", { scroll: false });
    }
    toast.success("Song deleted");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Song title"
        value={title}
        maxLength={120}
        onChange={(e) => useGritLab.getState().setTitle(e.target.value)}
        className="h-9 w-full max-w-xs font-semibold sm:w-64"
      />
      <span className="w-24 text-xs text-muted-foreground" aria-live="polite">
        {dirty ? "Unsaved changes" : songId ? "Saved" : ""}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={() => useGritLab.temporal.getState().undo()}
        >
          <Undo2Icon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={() => useGritLab.temporal.getState().redo()}
        >
          <Redo2Icon />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            guard("Start a new song", () => {
              useGritLab.getState().newSong();
              router.replace("/dashboard/grit-lab", { scroll: false });
            })
          }
        >
          <FilePlusIcon /> New
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => guard("Open another song", () => void showOpen())}
        >
          <FolderOpenIcon /> Open
        </Button>
        <Button type="button" size="sm" disabled={saving} onClick={save}>
          {saving ? <Spinner /> : <SaveIcon />} Save
        </Button>
      </div>

      <Dialog open={openList} onOpenChange={setOpenList}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open a song</DialogTitle>
            <DialogDescription>Your saved melodies, most recent first.</DialogDescription>
          </DialogHeader>
          {songs === null ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : songs.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No saved songs yet. Save the current one to see it here.
            </p>
          ) : (
            <ul className="max-h-80 divide-y overflow-y-auto">
              {songs.map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-1">
                  <button
                    type="button"
                    onClick={() => void open(s.id)}
                    className="flex min-w-0 flex-1 flex-col items-start rounded-md px-2 py-2 text-left hover:bg-muted/60"
                  >
                    <span className="w-full truncate font-medium">{s.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.noteCount} notes · {dateFmt.format(new Date(s.updatedAt))}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${s.title}`}
                    onClick={() => setConfirm({ label: `Delete "${s.title}"`, run: () => void remove(s.id) })}
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.label.startsWith("Delete")
                ? "The song will be removed from your account. This can't be undone."
                : "You have unsaved changes in this song. They will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirm?.run();
                setConfirm(null);
              }}
            >
              {confirm?.label.startsWith("Delete") ? "Delete" : "Discard changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
