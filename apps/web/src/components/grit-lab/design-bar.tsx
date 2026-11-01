"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  FilePlusIcon,
  LibraryIcon,
  Redo2Icon,
  SaveIcon,
  SendIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "zustand";
import { soundOf, type Tone } from "@voxilizer/engine";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useMelody } from "@/components/melody-studio/store";
import { toneSummary } from "@/components/melody-studio/tone-picker";
import { toneNameSchema, type SavedTone } from "@/lib/validation/tones";
import { originOf, toneFromLibrary, useToneLibrary } from "./library";
import { designData, useDesignDirty, useGritLab } from "./store";

const dateFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

/** The design as a song tone: its sound, labelled with the library tone it came from. */
function designAsTone(): Tone {
  const s = useGritLab.getState();
  return { ...soundOf(s.tone), ...(s.loaded ? { origin: s.loaded } : {}) };
}

/** Name, save, the tone library, undo/redo and the way to Melody Studio. */
export function DesignBar() {
  const router = useRouter();
  const loaded = useGritLab((s) => s.loaded);
  const target = useGritLab((s) => s.target);
  const dirty = useDesignDirty();
  const canUndo = useStore(useGritLab.temporal, (t) => t.pastStates.length > 0);
  const canRedo = useStore(useGritLab.temporal, (t) => t.futureStates.length > 0);
  const melodySelection = useMelody((s) => s.selection.length);
  const melodyTitle = useMelody((s) => s.song.title);
  const library = useToneLibrary();

  const [saveOpen, setSaveOpen] = useState<null | "save" | "new">(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    body: string;
    action: string;
    run: () => void;
  }>(null);

  const loadLibrary = library.load;
  useEffect(() => void loadLibrary(), [loadLibrary]);

  // Undo / redo shortcuts (not while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey) || (e.key.toLowerCase() !== "z" && e.key.toLowerCase() !== "y")) return;
      e.preventDefault();
      if (e.key.toLowerCase() === "y" || e.shiftKey) useGritLab.temporal.getState().redo();
      else useGritLab.temporal.getState().undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Ask before throwing away unsaved changes to a library tone. */
  function guard(title: string, run: () => void) {
    if (dirty)
      setConfirm({
        title,
        body: `You've changed "${loaded?.name}" since it was saved. Those changes will be lost.`,
        action: "Discard changes",
        run,
      });
    else run();
  }

  function openSave(mode: "save" | "new") {
    setName(mode === "save" && loaded ? loaded.name : "");
    setNameError(null);
    setSaveOpen(mode);
  }

  async function save() {
    const parsed = toneNameSchema.safeParse(name);
    if (!parsed.success) return setNameError(parsed.error.issues[0]?.message ?? "Check the name.");
    setSaving(true);
    const s = useGritLab.getState();
    const r = await library.save(parsed.data, designData(s), saveOpen === "save" ? s.loaded?.id : null);
    setSaving(false);
    if (typeof r === "string") return setNameError(r);
    s.markSaved(originOf(r));
    setSaveOpen(null);
    toast.success(`Saved "${r.name}" to your tones`);
  }

  function open(t: SavedTone) {
    guard(`Open "${t.name}"`, () => {
      useGritLab.getState().openTone(toneFromLibrary(t), { singer: t.data.singer, preview: t.data.preview });
      setLibOpen(false);
    });
  }

  function remove(t: SavedTone) {
    setConfirm({
      title: `Delete "${t.name}"`,
      body: "It will be removed from your library. Songs that use it keep their own copy.",
      action: "Delete",
      run: async () => {
        const err = await library.remove(t.id);
        if (err) return toast.error(err);
        if (useGritLab.getState().loaded?.id === t.id) useGritLab.setState({ loaded: null, savedJson: "" });
        toast.success(`Deleted "${t.name}"`);
      },
    });
  }

  /** Send the design to Melody Studio: as the song tone, or onto notes. */
  function sendTo(where: "song" | "selection" | "target") {
    const tone = designAsTone();
    const m = useMelody.getState();
    const t = useGritLab.getState().target;
    if (where === "target" && t?.kind === "notes") m.setNotesTone(tone, t.ids);
    else if (where === "selection") m.setNotesTone(tone);
    else m.setSongTone(tone);
    useGritLab.getState().setTarget(null);
    toast.success(
      where === "selection" || (where === "target" && t?.kind === "notes")
        ? "Tone applied to the notes"
        : "Song tone updated",
    );
    router.push("/dashboard/melody-studio");
  }

  const title = loaded ? loaded.name : "Untitled tone";

  return (
    <div className="flex flex-col gap-3">
      {target && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm"
        >
          <span className="min-w-0 flex-1">
            Editing{" "}
            {target.kind === "song"
              ? "the song tone"
              : `${target.ids.length === 1 ? "a note" : `${target.ids.length} notes`}`}{" "}
            of <span className="font-medium">{target.songTitle}</span> from Melody Studio.
          </span>
          <Button type="button" size="sm" onClick={() => sendTo("target")}>
            <ArrowLeftIcon /> Use it there and go back
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => useGritLab.getState().setTarget(null)}
          >
            Stop editing for the song
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold" data-testid="design-name">
            {title}
          </span>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {loaded ? (dirty ? "Unsaved changes" : "Saved in My tones") : "Not saved yet"}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
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
            onClick={() => guard("Start a new tone", () => useGritLab.getState().newDesign())}
          >
            <FilePlusIcon /> New
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setLibOpen(true)}>
            <LibraryIcon /> My tones
          </Button>
          {loaded ? (
            <>
              <Button type="button" size="sm" onClick={() => openSave("save")} disabled={!dirty}>
                <SaveIcon /> Save
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => openSave("new")}>
                Save as new
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" onClick={() => openSave("new")}>
              <SaveIcon /> Save to My tones
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="secondary" size="sm">
                <SendIcon /> Use in Melody Studio <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => sendTo("song")}>
                As the song tone of &ldquo;{melodyTitle}&rdquo;
              </DropdownMenuItem>
              <DropdownMenuItem disabled={melodySelection === 0} onSelect={() => sendTo("selection")}>
                On the selected notes ({melodySelection})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={saveOpen !== null} onOpenChange={(o) => !o && setSaveOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{saveOpen === "save" ? `Save "${loaded?.name}"` : "Save to My tones"}</DialogTitle>
            <DialogDescription>
              {saveOpen === "save"
                ? "Songs that use this tone will offer to update to the new version."
                : "Saves the sound, the singer and the preview note, so it opens exactly like this."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Label htmlFor="tone-name">Name</Label>
            <Input
              id="tone-name"
              value={name}
              maxLength={60}
              autoFocus
              placeholder="e.g. My rock grit"
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              aria-invalid={nameError !== null}
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            <p className="text-xs text-muted-foreground">{toneSummary(useGritLab.getState().tone)}</p>
            <Button type="submit" disabled={saving} className="self-end">
              {saving ? <Spinner /> : <SaveIcon />} Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={libOpen} onOpenChange={setLibOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>My tones</DialogTitle>
            <DialogDescription>
              Open a saved tone to hear it, change it, or use it in a song.
            </DialogDescription>
          </DialogHeader>
          {library.status === "loading" || library.status === "idle" ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : library.status === "error" ? (
            <div className="flex flex-col items-start gap-2 py-2">
              <p className="text-sm text-destructive">{library.error}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void library.load(true)}>
                Try again
              </Button>
            </div>
          ) : library.tones.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No saved tones yet. Design one, then use &ldquo;Save to My tones&rdquo;.
            </p>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {library.tones.map((t) => (
                <li key={t.id} className="flex items-center gap-2 py-1">
                  <button
                    type="button"
                    onClick={() => open(t)}
                    className="flex min-w-0 flex-1 flex-col items-start rounded-md px-2 py-2 text-left hover:bg-muted/60"
                  >
                    <span className="w-full truncate font-medium">
                      {t.name}
                      {loaded?.id === t.id && <span className="ml-2 text-xs text-primary">open</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {toneSummary(t.data.tone)} · {dateFmt.format(new Date(t.savedAt))}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${t.name}`}
                    onClick={() => remove(t)}
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
            <AlertDialogTitle>{confirm?.title}?</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirm?.run();
                setConfirm(null);
              }}
            >
              {confirm?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
