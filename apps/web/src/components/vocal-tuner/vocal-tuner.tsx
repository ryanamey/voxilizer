"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  HeadphonesIcon,
  MicIcon,
  MicOffIcon,
  ShuffleIcon,
  SquareIcon,
  Volume2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/grit-lab/controls";
import { cn } from "@/lib/utils";
import { listenToMic, playNote, referenceContext, type MicListener, type PlayingNote } from "./audio";
import { saveSoundPrefs, useSoundPrefs } from "./prefs";
import { nextMix, renderTimbre, TIMBRES, type RenderedNote, type SoundId, type TimbreId } from "./timbres";
import { PianoKeyboard } from "./piano-keyboard";
import { PitchTrail, type TrailPoint } from "./pitch-trail";
import {
  direction as directionOf,
  distanceText,
  HOLD_MS,
  initialTuner,
  KEY_MAX,
  KEY_MIN,
  keyName,
  TOLERANCES,
  tunerStep,
  type ToleranceId,
  type TunerState,
} from "./tuner";

/** Random practice notes stay in a comfortable singing range (E2–C6). */
const RANDOM_RANGE = [40, 84] as const;
export function VocalTuner() {
  const [target, setTarget] = useState<number | null>(60);
  const [tolerance, setTolerance] = useState<ToleranceId>("normal");
  const [playOnSelect, setPlayOnSelect] = useState(true);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [state, setState] = useState<TunerState>(() => initialTuner(0, true));
  const { timbre, singer, sustain } = useSoundPrefs();
  /** The timbre Mix chose for the current target. */
  const [mixSound, setMixSound] = useState<SoundId>("clean");
  const sounds = useRef(new Map<string, RenderedNote>());
  /** The reference note now sounding, and whether it is a held one (shows Stop). */
  const playingNote = useRef<PlayingNote | null>(null);
  const [holding, setHolding] = useState(false);
  const sound: SoundId = timbre === "mix" ? mixSound : timbre;

  const mic = useRef<MicListener | null>(null);
  const trail = useRef<TrailPoint[]>([]);
  // The rAF loop reads these without re-subscribing.
  const live = useRef({ target, tol: TOLERANCES[tolerance].cents, state });
  useEffect(() => {
    live.current.target = target;
    live.current.tol = TOLERANCES[tolerance].cents;
  }, [target, tolerance]);

  const reset = useCallback((t: number | null) => {
    const s = initialTuner(performance.now(), t !== null);
    live.current.state = s;
    setState(s);
    trail.current = [];
  }, []);

  const stopNote = useCallback(() => {
    playingNote.current?.stop();
    playingNote.current = null;
    setHolding(false);
  }, []);

  const hear = useCallback(
    (midi: number, which: SoundId = sound) => {
      stopNote();
      const ctx = referenceContext(mic.current?.context);
      const key = `${which}:${midi}:${singer}:${sustain}:${ctx.sampleRate}`;
      let note = sounds.current.get(key);
      if (!note) {
        note = renderTimbre(which, midi, ctx.sampleRate, singer, sustain);
        sounds.current.set(key, note);
        // Keep memory bounded: forget the oldest notes.
        while (sounds.current.size > 32) sounds.current.delete(sounds.current.keys().next().value!);
      }
      const playing = playNote(note, ctx);
      playingNote.current = playing;
      if (sustain) {
        // Sing along: the microphone keeps listening (headphones keep the speaker out of it).
        setHolding(true);
        playing.onEnded(() => {
          if (playingNote.current === playing) {
            playingNote.current = null;
            setHolding(false);
          }
        });
      } else {
        // Don't let the microphone hear the reference note and lock onto it.
        mic.current?.muteUntil(performance.now() + playing.audibleMs + 150);
      }
    },
    [sound, singer, sustain, stopNote],
  );

  // A held note stops when leaving the page (and, in the microphone loop, once the note is locked).
  useEffect(() => () => playingNote.current?.stop(), []);

  const choose = useCallback(
    (midi: number) => {
      const t = Math.max(KEY_MIN, Math.min(KEY_MAX, midi));
      // Mix: every new target gets a different timbre.
      const which = timbre === "mix" ? nextMix(mixSound) : sound;
      if (timbre === "mix") setMixSound(which);
      setTarget(t);
      reset(t);
      if (playOnSelect) hear(t, which);
    },
    [hear, playOnSelect, reset, timbre, mixSound, sound],
  );

  async function toggleMic() {
    // A note playing on the old audio context would be cut off: stop it cleanly first.
    stopNote();
    if (mic.current) {
      mic.current.stop();
      mic.current = null;
      setListening(false);
      reset(target);
      return;
    }
    setMicError(null);
    try {
      mic.current = await listenToMic((midi, _level, now) => {
        const { target: t, tol } = live.current;
        const next = tunerStep(live.current.state, midi, now, t, tol);
        // Locked on: a held reference note has done its job.
        if (next.status === "locked" && live.current.state.status !== "locked") stopNote();
        live.current.state = next;
        setState(next);
        const pts = trail.current;
        pts.push({
          t: now,
          midi: next.sung,
          inTune: next.offCents !== null && Math.abs(next.offCents) <= tol,
        });
        while (pts.length && now - pts[0]!.t > 7000) pts.shift();
      });
      setListening(true);
      reset(target);
    } catch {
      setMicError(
        "The microphone couldn't start. Allow microphone access for this site in your browser, then try again.",
      );
    }
  }

  useEffect(() => () => mic.current?.stop(), []);

  // Arrow keys move the target a semitone when the page has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (target === null || (e.target as HTMLElement)?.closest("input, textarea, [role=slider]")) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        choose(target + (e.key === "ArrowLeft" ? -1 : 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, target]);

  const tol = TOLERANCES[tolerance].cents;
  const dir = directionOf(state, tol);
  const onTarget = state.status === "holding" || state.status === "locked";
  const semis = target !== null && state.sungKey !== null ? target - state.sungKey : 0;
  const hint =
    state.sungKey !== null && target !== null && state.sungKey !== target ? distanceText(semis) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={toggleMic} variant={listening ? "secondary" : "default"} size="lg">
          {listening ? <MicOffIcon /> : <MicIcon />}
          {listening ? "Stop listening" : "Start listening"}
        </Button>
        {holding ? (
          <Button variant="outline" onClick={stopNote}>
            <SquareIcon />
            Stop {target !== null ? keyName(target) : "the note"}
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => target !== null && hear(target)}
            disabled={target === null}
          >
            <Volume2Icon />
            Hear {target !== null ? keyName(target) : "the note"}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() =>
            choose(RANDOM_RANGE[0] + Math.floor(Math.random() * (RANDOM_RANGE[1] - RANDOM_RANGE[0] + 1)))
          }
        >
          <ShuffleIcon />
          Random note
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Switch id="play-on-select" checked={playOnSelect} onCheckedChange={setPlayOnSelect} />
          <Label htmlFor="play-on-select" className="font-normal">
            Play the note when I pick it
          </Label>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Segmented
          label="Reference sound"
          size="sm"
          value={timbre}
          options={(Object.keys(TIMBRES) as TimbreId[]).map((id) => ({
            value: id,
            label: TIMBRES[id].label,
            hint: TIMBRES[id].hint,
          }))}
          onChange={(id) => {
            saveSoundPrefs({ timbre: id });
            const which = id === "mix" ? nextMix(sound) : id;
            if (id === "mix") setMixSound(which);
            if (target !== null) hear(target, which);
          }}
        />
        {(timbre === "voice" || timbre === "mix") && (
          <Segmented
            label="Voice"
            size="sm"
            value={singer}
            options={[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ]}
            onChange={(s) => {
              saveSoundPrefs({ singer: s });
            }}
          />
        )}
        <div className="flex items-center gap-2 pb-2">
          <Switch
            id="sustain"
            checked={sustain}
            onCheckedChange={(on) => {
              stopNote();
              saveSoundPrefs({ sustain: on });
            }}
          />
          <Label htmlFor="sustain" className="font-normal">
            Sustain (sing along)
          </Label>
        </div>
        {timbre === "mix" && (
          <p className="pb-2 text-sm text-muted-foreground" aria-live="polite">
            This note: <span className="font-medium text-foreground">{TIMBRES[mixSound].label}</span>
          </p>
        )}
      </div>
      {sustain ? (
        <p className="-mt-3 flex items-start gap-2 rounded-md border border-stage-3/50 bg-stage-3/10 px-3 py-2 text-xs">
          <HeadphonesIcon className="mt-px size-4 shrink-0 text-stage-3" />
          <span>
            Use headphones. The note keeps sounding while you sing (Clean and Voice until you stop it or lock
            on; Piano and Guitar ring and fade), and the microphone keeps listening. Through speakers it would
            hear the note instead of you.
          </span>
        </p>
      ) : (
        <p className="-mt-3 text-xs text-muted-foreground">
          The note plays briefly, then you find it from memory. Changing the sound trains your ear to hear the
          pitch itself, not the colour around it. Turn on Sustain to sing along with it instead.
        </p>
      )}
      {micError && <p className="text-sm text-destructive">{micError}</p>}

      <PianoKeyboard
        target={target}
        sung={state.sungKey}
        onTarget={onTarget}
        direction={dir}
        hint={hint}
        onSelect={choose}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Readout state={state} target={target} tol={tol} listening={listening} hint={hint} />
        <div className="flex flex-col gap-4">
          <PitchTrail points={trail} target={target} toleranceCents={tol} />
          <Segmented
            label="How close counts as in tune"
            size="sm"
            value={tolerance}
            options={(Object.keys(TOLERANCES) as ToleranceId[]).map((id) => ({
              value: id,
              label: TOLERANCES[id].label,
              hint: TOLERANCES[id].hint,
            }))}
            onChange={(id) => {
              setTolerance(id);
              reset(target);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Click a key, then sing it. Use headphones if you play the note while listening. ← and → move the
            target by a semitone. A cent is a hundredth of a semitone.
          </p>
        </div>
      </div>
    </div>
  );
}

function Readout({
  state,
  target,
  tol,
  listening,
  hint,
}: {
  state: TunerState;
  target: number | null;
  tol: number;
  listening: boolean;
  hint: string | null;
}) {
  const { status, offCents, sungKey } = state;
  const sungName = sungKey !== null ? keyName(sungKey) : "–";
  const message = (() => {
    if (target === null) return "Choose a note on the piano.";
    if (!listening) return `Press Start listening, then sing ${keyName(target)}.`;
    switch (status) {
      case "silent":
        return `Sing ${keyName(target)}.`;
      case "wrong-note":
        return `You're on ${sungName}. Go ${hint}.`;
      case "wrong-octave":
        return `Right note, wrong octave: you're on ${sungName}. Go ${hint}.`;
      case "close":
        return offCents! > 0
          ? `Almost: ${Math.round(offCents!)} cents sharp. Come down a little.`
          : `Almost: ${Math.round(-offCents!)} cents flat. Go up a little.`;
      case "holding":
        return `That's it. Hold ${keyName(target)}…`;
      case "locked":
        return `Locked: you held ${keyName(target)} for 2 seconds.`;
      default:
        return "";
    }
  })();

  // Needle: cents from the target when within a semitone, otherwise pinned to the side.
  const needle = offCents === null ? null : Math.max(-50, Math.min(50, offCents));
  const holdPct = Math.min(100, (state.heldMs / HOLD_MS) * 100);
  const tone =
    status === "locked" || status === "holding"
      ? "text-stage-clean"
      : status === "silent" || status === "idle"
        ? "text-muted-foreground"
        : "text-stage-4";
  const foundIn =
    state.lockedAt !== null ? ((state.lockedAt - state.startedAt - HOLD_MS) / 1000).toFixed(1) : null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5" aria-live="polite">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Target</p>
          <p className="text-3xl font-bold text-stage-clean">{target !== null ? keyName(target) : "–"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">You</p>
          <p className={cn("text-5xl font-bold tabular-nums", tone)} data-testid="sung-note">
            {sungName}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="relative h-8 rounded-md bg-muted">
          <div
            className="absolute inset-y-0 rounded-md bg-stage-clean/25"
            style={{ left: `${50 - tol}%`, width: `${tol * 2}%` }}
          />
          <div className="absolute inset-y-0 left-1/2 w-px bg-stage-clean" />
          {needle !== null && (
            <div
              className={cn(
                "absolute inset-y-1 w-1.5 -translate-x-1/2 rounded-full transition-[left] duration-75",
                Math.abs(offCents!) <= tol ? "bg-stage-clean" : "bg-stage-4",
              )}
              style={{ left: `${50 + needle}%` }}
            />
          )}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>50 cents flat</span>
          <span>
            {offCents !== null ? `${offCents > 0 ? "+" : ""}${Math.round(offCents)} cents` : "in tune"}
          </span>
          <span>50 cents sharp</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-stage-clean transition-[width] duration-100"
            style={{ width: `${holdPct}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">Hold for 2 seconds</p>
      </div>

      <p className={cn("flex items-center gap-2 text-sm font-medium", tone)} data-testid="tuner-message">
        {status === "locked" && <CheckCircle2Icon className="size-4 shrink-0" />}
        {message}
      </p>
      {foundIn !== null && (
        <p className="text-xs text-muted-foreground">
          Found it in {foundIn} s. Pick another note to keep going.
        </p>
      )}
    </div>
  );
}
