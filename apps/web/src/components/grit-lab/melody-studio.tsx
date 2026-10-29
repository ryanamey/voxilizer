"use client";

import { useMemo, useState } from "react";
import { PlayIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  analyzeLoad,
  checkSong,
  EFFECTS,
  EFFECT_IDS,
  MODES,
  MODE_IDS,
  noteName,
  sungVowel,
  VOWELS,
  worstSeverity,
  type CheckSeverity,
  type Note,
} from "@voxilizer/engine";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useGritLabAudio, usePlaybackPosition } from "./audio-context";
import { LabeledSlider, Segmented } from "./controls";
import { ChecksList, SEVERITY_STYLE, VolumeSlider, VOWEL_OPTIONS } from "./cvt-ui";
import { PianoRoll } from "./piano-roll";
import { useGritLab } from "./store";

const STAGE_BG = ["bg-stage-clean", "bg-stage-clean", "bg-stage-2", "bg-stage-3", "bg-stage-4"] as const;
const LENGTHS = [
  { value: "1", label: "1/16" },
  { value: "2", label: "1/8" },
  { value: "4", label: "1/4" },
  { value: "8", label: "1/2" },
] as const;

function lengthLabel(steps: number) {
  if (steps === 1) return "1/16 note";
  if (steps === 2) return "1/8 note";
  if (steps % 4 === 0) return `${steps / 4} beat${steps === 4 ? "" : "s"}`;
  return `${steps}/16 notes`;
}

export function MelodyStudio() {
  const { engine, play, stop, playing } = useGritLabAudio();
  const position = usePlaybackPosition();
  const song = useGritLab((s) => s.song);
  const selection = useGritLab((s) => s.selection);
  const newVowel = useGritLab((s) => s.newVowel);
  const newLength = useGritLab((s) => s.newLength);
  const st = useGritLab.getState();
  const [stepSeconds, setStepSeconds] = useState(60 / song.tempo / 4);
  const [rendering, setRendering] = useState(false);

  const load = useMemo(() => analyzeLoad(song), [song]);
  const cvt = useMemo(() => checkSong(song), [song]);
  const noteFlags = useMemo(() => {
    const out: Record<string, CheckSeverity> = {};
    for (const [id, list] of Object.entries(cvt.notes)) {
      const w = worstSeverity(list);
      if (w) out[id] = w;
    }
    return out;
  }, [cvt]);
  const flagged = useMemo(
    () =>
      song.notes
        .filter((n) => noteFlags[n.id] === "avoid" || noteFlags[n.id] === "caution")
        .sort((a, b) => a.start - b.start),
    [song.notes, noteFlags],
  );
  const selected = useMemo(() => {
    const ids = new Set(selection);
    return song.notes.filter((n) => ids.has(n.id)).sort((a, b) => a.start - b.start);
  }, [song.notes, selection]);
  const totalSteps = song.bars * 16;
  const playStep = playing === "melody" && position >= 0 ? position / stepSeconds : -1;

  async function playNotes(notes: Note[], kind: "melody" | "selection") {
    if (!notes.length) return;
    setRendering(true);
    try {
      const s = useGritLab.getState().song;
      const audio = await engine.renderMelody(notes, { tempo: s.tempo, songTone: s.tone, voice: s.voice });
      setStepSeconds(audio.secondsPerStep);
      await play(audio, kind);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Playback failed.");
    } finally {
      setRendering(false);
    }
  }

  function audition(notes: Note[]) {
    void playNotes(notes, "selection");
  }

  const first = selected[0];
  const following = selected.length > 0 && selected.every((n) => !n.tone);
  const shownTone = first ? (first.tone ?? song.tone) : song.tone;
  const sameVowel = first && selected.every((n) => n.vowel === first.vowel) ? first.vowel : null;

  return (
    <section aria-labelledby="melody-heading" className="flex flex-col gap-5 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="melody-heading" className="text-xl font-bold tracking-tight">
          Melody studio
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Write the vocal line and give each note a vowel. The panel above sets the song tone; select notes to
          override it.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        {playing === "melody" ? (
          <Button type="button" onClick={stop}>
            <SquareIcon /> Stop
          </Button>
        ) : (
          <Button
            type="button"
            disabled={rendering || !song.notes.length}
            onClick={() => void playNotes(song.notes, "melody")}
          >
            <PlayIcon /> {rendering ? "Rendering…" : "Play melody"}
          </Button>
        )}
        <div className="w-48">
          <LabeledSlider
            id="tempo"
            label="Tempo"
            value={song.tempo}
            min={60}
            max={180}
            display={`${song.tempo} BPM`}
            onChange={(v) => st.setTempo(v)}
          />
        </div>
        <Segmented
          label="New note length"
          size="sm"
          value={String(newLength) as (typeof LENGTHS)[number]["value"]}
          options={[...LENGTHS]}
          onChange={(v) => st.setNewLength(Number(v))}
        />
        <Segmented
          label="Bars"
          size="sm"
          value={String(song.bars) as "4" | "8"}
          options={[
            { value: "4", label: "4" },
            { value: "8", label: "8" },
          ]}
          onChange={(v) => st.setBars(Number(v))}
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" className="text-destructive" disabled={!song.notes.length}>
              <Trash2Icon /> Clear melody
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear the whole melody?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes all {song.notes.length} notes. You can undo it with Undo or Ctrl+Z.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep notes</AlertDialogCancel>
              <AlertDialogAction onClick={() => st.commitNotes([], [])}>Clear melody</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-3">
          <PianoRoll
            noteStages={load.noteStages}
            noteFlags={noteFlags}
            playStep={playStep}
            onAudition={audition}
          />
          <div
            className="relative h-4 overflow-hidden rounded border bg-scope"
            role="img"
            aria-label="Vocal load across the song"
          >
            {song.notes.map((n) => (
              <span
                key={n.id}
                className={cn("absolute inset-y-0", STAGE_BG[load.noteStages[n.id] ?? 0])}
                style={{
                  left: `${(n.start / totalSteps) * 100}%`,
                  width: `${(n.length / totalSteps) * 100}%`,
                }}
                title={`${noteName(n.pitch)} ${n.vowel}: stage ${load.noteStages[n.id] ?? 0}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
            <span>
              <i className="mr-1.5 inline-block size-2.5 rounded-sm bg-stage-clean align-[-1px]" />
              clean / stage 0–1
            </span>
            <span>
              <i className="mr-1.5 inline-block size-2.5 rounded-sm bg-stage-2 align-[-1px]" />
              stage 2
            </span>
            <span>
              <i className="mr-1.5 inline-block size-2.5 rounded-sm bg-stage-3 align-[-1px]" />
              stage 3
            </span>
            <span>
              <i className="mr-1.5 inline-block size-2.5 rounded-sm bg-stage-4 align-[-1px]" />
              stage 4+
            </span>
          </div>
          <div className="flex flex-col gap-1 text-sm" aria-live="polite">
            {song.notes.length === 0 ? (
              <p className="text-muted-foreground">Add notes to see the vocal load of this line.</p>
            ) : (
              <>
                <p>
                  {load.sungSeconds.toFixed(1)} s sung · {load.roughSeconds.toFixed(1)} s with an effect (
                  {Math.round(load.roughShare * 100)}%) · heaviest note: stage {load.heaviestStage}
                </p>
                {load.warnings.map((w) => (
                  <p key={w.kind} className="text-stage-3">
                    {w.message}
                  </p>
                ))}
                {load.warnings.length === 0 && load.roughSeconds > 0 && (
                  <p className="text-stage-clean">
                    Rough passages are broken up by clean singing. Good for stamina.
                  </p>
                )}
                <p>
                  CVT check:{" "}
                  {cvt.counts.avoid + cvt.counts.caution + cvt.counts.tip === 0 ? (
                    <span className="text-stage-clean">every note sits in the centre of its mode.</span>
                  ) : (
                    <>
                      <span className={SEVERITY_STYLE.avoid.text}>{cvt.counts.avoid} to avoid</span> ·{" "}
                      <span className={SEVERITY_STYLE.caution.text}>{cvt.counts.caution} cautions</span> ·{" "}
                      <span className={SEVERITY_STYLE.tip.text}>{cvt.counts.tip} tips</span>
                      <span className="text-muted-foreground"> (dashed outlines in the roll)</span>
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </div>

        <aside aria-label="Note inspector" className="flex flex-col gap-4 rounded-lg border p-4">
          {selected.length === 0 ? (
            <>
              <p className="font-semibold">No notes selected</p>
              <p className="text-sm text-muted-foreground">
                Click the grid to add a note, drag to move it, drag its right edge to resize. Shift-click
                selects several notes. Delete removes them; arrow keys move them.
              </p>
              <Segmented
                label="Vowel for new notes"
                value={newVowel}
                options={VOWEL_OPTIONS}
                onChange={(v) => st.setNewVowel(v)}
              />
              {flagged.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide uppercase">Notes to look at</span>
                  <ul className="flex flex-col gap-1">
                    {flagged.slice(0, 6).map((n) => {
                      const c = cvt.notes[n.id]!.find((x) => x.severity !== "tip")!;
                      return (
                        <li key={n.id}>
                          <button
                            type="button"
                            className="flex w-full items-start gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
                            onClick={() => st.setSelection([n.id])}
                          >
                            <span
                              className={cn(
                                "mt-1.5 size-2 shrink-0 rounded-full",
                                SEVERITY_STYLE[c.severity].dot,
                              )}
                              aria-hidden
                            />
                            <span>
                              <span className="font-mono">{noteName(n.pitch)}</span>{" "}
                              <span className="text-muted-foreground">{c.title}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {flagged.length > 6 && (
                    <p className="px-2 text-xs text-muted-foreground">
                      and {flagged.length - 6} more, marked with dashed outlines
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="font-semibold">
                {selected.length === 1 && first
                  ? `${noteName(first.pitch)} · ${lengthLabel(first.length)}`
                  : `${selected.length} notes selected`}
              </p>
              <p className="text-sm text-muted-foreground">
                Changes apply to every selected note. A dot marks a note with its own tone.
              </p>
              <Segmented
                label="Vowel"
                value={sameVowel}
                options={VOWEL_OPTIONS}
                onChange={(v) => st.setSelectedVowel(v)}
              />
              {selected.length === 1 && first && <SungAs note={first} />}
              <div className="flex items-center gap-2">
                <Switch
                  id="follow-song"
                  checked={following}
                  onCheckedChange={(on) => st.setSelectedTone(on ? null : {})}
                />
                <Label htmlFor="follow-song" className="font-normal">
                  Follow song tone
                </Label>
              </div>
              <fieldset disabled={following} className={cn("flex flex-col gap-4", following && "opacity-50")}>
                <legend className="sr-only">Note tone</legend>
                <Segmented
                  label="Mode"
                  size="sm"
                  value={shownTone.mode}
                  disabled={following}
                  options={MODE_IDS.map((m) => ({ value: m, label: MODES[m].label }))}
                  onChange={(mode) => st.setSelectedTone({ mode })}
                />
                <VolumeSlider
                  id="note-volume"
                  mode={shownTone.mode}
                  value={shownTone.volume}
                  disabled={following}
                  onChange={(volume) => st.setSelectedTone({ volume })}
                />
                {shownTone.mode === "neutral" && (
                  <LabeledSlider
                    id="note-air"
                    label="Audible air"
                    value={shownTone.air}
                    min={0}
                    max={100}
                    display={shownTone.air ? `${shownTone.air}%` : "none"}
                    disabled={following}
                    onChange={(air) => st.setSelectedTone({ air })}
                  />
                )}
                <Segmented
                  label="Effect"
                  size="sm"
                  value={shownTone.effect}
                  disabled={following}
                  options={EFFECT_IDS.map((e) => ({ value: e, label: EFFECTS[e].label }))}
                  onChange={(effect) => st.setSelectedTone({ effect })}
                />
                <LabeledSlider
                  id="note-amount"
                  label="Effect amount"
                  value={shownTone.amount}
                  min={0}
                  max={100}
                  display={`${shownTone.amount}%`}
                  disabled={following}
                  onChange={(amount) => st.setSelectedTone({ amount })}
                />
                <LabeledSlider
                  id="note-ff"
                  label="Distortion"
                  value={shownTone.ff}
                  min={0}
                  max={100}
                  display={shownTone.ff ? `${shownTone.ff}%` : "off"}
                  disabled={following}
                  onChange={(ff) => st.setSelectedTone({ ff })}
                />
              </fieldset>
              {selected.length === 1 && first && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide uppercase">CVT check</span>
                  <ChecksList
                    checks={cvt.notes[first.id] ?? []}
                    onFix={(fix) => st.applyNoteFix(first.id, fix)}
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const off = selected[0]!.start;
                    void playNotes(
                      selected.map((n) => ({ ...n, start: n.start - off })),
                      "selection",
                    );
                  }}
                >
                  <PlayIcon /> Preview selection
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => st.deleteSelected()}
                >
                  <Trash2Icon /> Delete
                </Button>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

/** Shows the vowel CVT asks you to sing when it differs from the written one. */
function SungAs({ note }: { note: Note }) {
  const song = useGritLab((s) => s.song);
  const tone = note.tone ?? song.tone;
  const sung = sungVowel(note.vowel, tone.mode, note.pitch, song.voice.singer);
  if (sung === note.vowel) return null;
  return (
    <p className="text-sm">
      Sung as <span className="font-semibold">{sung}</span>{" "}
      <span className="text-muted-foreground">
        (as in &ldquo;{VOWELS[sung].word}&rdquo;) to stay in {MODES[tone.mode].label}.
      </span>
    </p>
  );
}
