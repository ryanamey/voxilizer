"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopyIcon, MicIcon, PlayIcon, SquareIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import {
  EFFECTS,
  EFFECT_IDS,
  MODES,
  MODE_IDS,
  PITCH_MAX,
  PITCH_MIN,
  VOWELS,
  VOWEL_IDS,
  midiToHz,
  noteName,
  stageOf,
  toneNotes,
  type Note,
  type Tone,
  type VoiceSettings,
} from "@voxilizer/engine";
import type { RenderedAudio, TakeInfo } from "@/audio/audio-engine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useGritLabAudio } from "./audio-context";
import { ControlGroup, LabeledSlider, Segmented } from "./controls";
import { hzToNoteName, recipeText, STAGE_INFO } from "./recipe";
import { Scopes } from "./scopes";
import { useGritLab, type Preview } from "./store";

const PRESETS: { name: string; tone: Tone; voice: Partial<VoiceSettings>; preview: Partial<Preview> }[] = [
  {
    name: "Clean belt",
    tone: { mode: "overdrive", effect: "none", amount: 0, ff: 0 },
    voice: { larynx: 25, twang: 35, air: 0 },
    preview: { vowel: "A", pitch: 55 },
  },
  {
    name: "Rock grit",
    tone: { mode: "edge", effect: "none", amount: 0, ff: 40 },
    voice: { larynx: 30, twang: 50, air: 5 },
    preview: { vowel: "E", pitch: 57 },
  },
  {
    name: "Soul growl",
    tone: { mode: "curbing", effect: "growl", amount: 55, ff: 10 },
    voice: { larynx: 0, twang: 20, air: 5 },
    preview: { vowel: "O", pitch: 52 },
  },
  {
    name: "Raspy rattle",
    tone: { mode: "overdrive", effect: "rattle", amount: 50, ff: 20 },
    voice: { larynx: 10, twang: 25, air: 5 },
    preview: { vowel: "A", pitch: 50 },
  },
  {
    name: "Death grunt",
    tone: { mode: "neutral", effect: "grunt", amount: 85, ff: 0 },
    voice: { larynx: -65, twang: 0, air: 20 },
    preview: { vowel: "U", pitch: 45 },
  },
  {
    name: "Fry crackle",
    tone: { mode: "neutral", effect: "creak", amount: 50, ff: 0 },
    voice: { larynx: 0, twang: 10, air: 15 },
    preview: { vowel: "A", pitch: 48 },
  },
];

const CLEAN: Pick<Tone, "effect" | "amount" | "ff"> = { effect: "none", amount: 0, ff: 0 };
const STAGE_TONE = ["bg-stage-clean", "bg-stage-clean", "bg-stage-2", "bg-stage-3", "bg-stage-4"] as const;

/** Notes for the single-note preview: a sustained note, or a short rising phrase. */
function previewNotes(preview: Preview): Note[] {
  const steps = preview.pattern === "phrase" ? [0, 4, 7, 4] : [0];
  const len = Math.round(8.8 / steps.length); // ~2.2 s at 60 BPM
  return steps.map((semi, i) => ({
    id: `p${i}`,
    pitch: Math.min(PITCH_MAX, preview.pitch + semi),
    start: i * len,
    length: len,
    vowel: preview.vowel,
    tone: null,
  }));
}

export function ToneDesigner() {
  const { engine, play, playSequence, stop, playing } = useGritLabAudio();
  const tone = useGritLab((s) => s.song.tone);
  const voice = useGritLab((s) => s.song.voice);
  const preview = useGritLab((s) => s.preview);
  const source = useGritLab((s) => s.source);
  const { setTone, setVoice, setPreview, setSource } = useGritLab.getState();

  const [audio, setAudio] = useState<RenderedAudio | null>(null);
  const [take, setTake] = useState<TakeInfo | null>(null);
  const [takeError, setTakeError] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const renderSeq = useRef(0);
  const mine = source === "mine";

  const takeRef = useRef<TakeInfo | null>(null);
  useEffect(() => {
    takeRef.current = take;
  }, [take]);

  /** Render from the latest store state (not a stale closure), so auto-play hears the new setting. */
  const render = useCallback(
    async (clean = false): Promise<RenderedAudio | null> => {
      const s = useGritLab.getState();
      const t = clean ? { ...s.song.tone, ...CLEAN } : s.song.tone;
      if (s.source === "mine") return takeRef.current ? engine.renderTake(t, s.song.voice, clean) : null;
      return engine.renderMelody(previewNotes(s.preview), { tempo: 60, songTone: t, voice: s.song.voice });
    },
    [engine],
  );

  // Re-render (silently) whenever the design changes, to keep the scopes live.
  useEffect(() => {
    const seq = ++renderSeq.current;
    const t = setTimeout(() => {
      render()
        .then((a) => seq === renderSeq.current && setAudio(a))
        .catch(() => undefined);
    }, 90);
    return () => clearTimeout(t);
  }, [render, tone, voice, preview, source, take]);

  const playCurrent = useCallback(async () => {
    try {
      const a = await render();
      if (!a) {
        setTakeError("Record or upload a take first.");
        return;
      }
      setAudio(a);
      await play(a, "tone");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Playback failed.");
    }
  }, [render, play]);

  /** Auto-play after a deliberate change (button press or slider release). */
  const committed = useCallback(() => {
    if (autoPlay) setTimeout(() => void playCurrent(), 0);
  }, [autoPlay, playCurrent]);

  async function playCleanThenEffect() {
    try {
      const [c, f] = await Promise.all([render(true), render()]);
      if (!c || !f) {
        setTakeError("Record or upload a take first.");
        return;
      }
      await playSequence([c, f], "tone");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Playback failed.");
    }
  }

  async function loadBlob(blob: Blob) {
    setTakeError(null);
    try {
      const info = await engine.loadTake(blob);
      setTake(info);
      setSource("mine");
      if (!info.medianF0 || info.voicedShare < 0.2)
        setTakeError(
          "We couldn't find a steady sung pitch. Effects work best on a held, clean vowel; try again a little louder and steadier.",
        );
    } catch (e) {
      setTakeError(
        e instanceof Error ? e.message : "That file couldn't be read. Try a WAV, MP3 or M4A voice memo.",
      );
    }
  }

  async function toggleRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      return;
    }
    setTakeError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        void loadBlob(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
      };
      rec.start();
      setRecording(true);
      setTimeout(() => rec.state === "recording" && rec.stop(), 12_000);
    } catch {
      setTakeError(
        "Microphone access was blocked. Allow it in your browser's site settings, or upload a recording instead.",
      );
    }
  }

  const f0 = mine ? take?.medianF0 || null : midiToHz(preview.pitch);
  const stage = stageOf(tone, voice);
  const notes = useMemo(() => toneNotes(tone, voice, f0 ?? 0, mine && !!take), [tone, voice, f0, mine, take]);
  const recipe = recipeText(tone, voice, preview, source, take);
  const caption = `${mine ? "Your voice" : MODES[tone.mode].label}${tone.effect !== "none" ? ` + ${EFFECTS[tone.effect].label}` : ""}${tone.ff ? " + distortion" : ""}`;

  async function copyRecipe() {
    try {
      await navigator.clipboard.writeText(recipe);
      toast.success("Recipe copied");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* ---------------- Controls ---------------- */}
      <div className="flex flex-col gap-5 rounded-xl border bg-card p-5">
        <ControlGroup title="Sound source" hint="synth, or your own voice">
          <Segmented
            label="Source"
            value={source}
            options={[
              { value: "synth", label: "Synth voice" },
              { value: "mine", label: "My voice" },
            ]}
            onChange={(v) => setSource(v)}
          />
          {mine && (
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">
                Sing one clean, comfortable vowel for 2–4 seconds at medium volume, with no grit. Your audio
                stays in this browser.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={recording ? "destructive" : "outline"}
                  size="sm"
                  onClick={toggleRecording}
                >
                  {recording ? <SquareIcon /> : <MicIcon />}
                  {recording ? "Stop recording" : "Record"}
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <label className="cursor-pointer">
                    <UploadIcon /> Upload a clip
                    <input
                      type="file"
                      accept="audio/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void loadBlob(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Button>
                <span
                  className={cn(
                    "font-mono text-xs",
                    take?.medianF0 ? "text-stage-clean" : "text-muted-foreground",
                  )}
                >
                  {take
                    ? `${take.durationSeconds.toFixed(1)} s${take.medianF0 ? ` · ${hzToNoteName(take.medianF0)} (${Math.round(take.medianF0)} Hz)` : ""}`
                    : "No take yet"}
                </span>
              </div>
              {takeError && (
                <p role="alert" className="text-sm text-stage-3">
                  {takeError}
                </p>
              )}
            </div>
          )}
        </ControlGroup>

        <ControlGroup title="Start from a preset">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.name}
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  setTone(p.tone);
                  setVoice(p.voice);
                  setPreview(p.preview);
                  committed();
                }}
              >
                {p.name}
              </Button>
            ))}
          </div>
        </ControlGroup>

        <ControlGroup title="Carrier" hint="the clean engine underneath">
          {mine && (
            <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              Your recording is the carrier: its pitch and vowel come from how you sang it.
            </p>
          )}
          <Segmented
            label="Mode"
            value={tone.mode}
            options={MODE_IDS.map((m) => ({ value: m, label: MODES[m].label, hint: MODES[m].hint }))}
            onChange={(mode) => {
              setTone({ mode });
              committed();
            }}
          />
          <LabeledSlider
            id="preview-pitch"
            label="Pitch"
            value={preview.pitch}
            min={PITCH_MIN}
            max={PITCH_MAX}
            display={`${noteName(preview.pitch)} · ${Math.round(midiToHz(preview.pitch))} Hz`}
            ends={[noteName(PITCH_MIN), noteName(PITCH_MAX)]}
            disabled={mine}
            onChange={(pitch) => setPreview({ pitch })}
            onCommit={committed}
          />
          <Segmented
            label="Vowel (tongue position)"
            value={preview.vowel}
            disabled={mine}
            options={VOWEL_IDS.map((v) => ({ value: v, label: v, hint: VOWELS[v].hint }))}
            onChange={(vowel) => {
              setPreview({ vowel });
              committed();
            }}
          />
          <div className="flex flex-wrap gap-6">
            <Segmented
              label="Voice"
              value={voice.voice}
              disabled={mine}
              size="sm"
              options={[
                { value: "low", label: "Lower" },
                { value: "high", label: "Higher" },
              ]}
              onChange={(v) => {
                setVoice({ voice: v });
                committed();
              }}
            />
            <Segmented
              label="Pattern"
              value={preview.pattern}
              disabled={mine}
              size="sm"
              options={[
                { value: "sustain", label: "Sustain" },
                { value: "phrase", label: "Phrase" },
              ]}
              onChange={(pattern) => {
                setPreview({ pattern });
                committed();
              }}
            />
          </div>
        </ControlGroup>

        <ControlGroup title="Effect" hint="the added vibration">
          <Segmented
            label="Effect type"
            value={tone.effect}
            options={EFFECT_IDS.map((e) => ({ value: e, label: EFFECTS[e].label, hint: EFFECTS[e].level }))}
            onChange={(effect) => {
              setTone({ effect });
              committed();
            }}
          />
          <LabeledSlider
            id="effect-amount"
            label="Effect amount"
            value={tone.amount}
            min={0}
            max={100}
            display={tone.effect === "none" ? "—" : `${tone.amount}%`}
            disabled={tone.effect === "none"}
            onChange={(amount) => setTone({ amount })}
            onCommit={committed}
          />
          <LabeledSlider
            id="false-fold"
            label="False-fold engagement (distortion)"
            value={tone.ff}
            min={0}
            max={100}
            display={tone.ff ? `${tone.ff}%` : "off"}
            ends={["off", "heavy grit"]}
            onChange={(ff) => setTone({ ff })}
            onCommit={committed}
          />
        </ControlGroup>

        <ControlGroup title="Vocal tract" hint="the filter that colours it">
          <LabeledSlider
            id="larynx"
            label="Larynx height"
            value={voice.larynx}
            min={-100}
            max={100}
            display={voice.larynx === 0 ? "neutral" : `${voice.larynx > 0 ? "+" : ""}${voice.larynx}`}
            ends={["low · dark", "high · bright"]}
            onChange={(larynx) => setVoice({ larynx })}
            onCommit={committed}
          />
          <LabeledSlider
            id="twang"
            label="Twang (aryepiglottic narrowing)"
            value={voice.twang}
            min={0}
            max={100}
            display={`${voice.twang}%`}
            onChange={(twang) => setVoice({ twang })}
            onCommit={committed}
          />
          <LabeledSlider
            id="air"
            label="Air added"
            value={voice.air}
            min={0}
            max={100}
            display={`${voice.air}%`}
            onChange={(air) => setVoice({ air })}
            onCommit={committed}
          />
        </ControlGroup>
      </div>

      {/* ---------------- Monitor ---------------- */}
      <div className="flex flex-col gap-5 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          {playing === "tone" ? (
            <Button type="button" onClick={stop}>
              <SquareIcon /> Stop
            </Button>
          ) : (
            <Button type="button" onClick={() => void playCurrent()}>
              <PlayIcon /> Play
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => void playCleanThenEffect()}>
            Clean → with effect
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Switch id="auto-play" checked={autoPlay} onCheckedChange={setAutoPlay} />
            <Label htmlFor="auto-play" className="text-sm font-normal text-muted-foreground">
              Play on change
            </Label>
          </div>
        </div>

        <Scopes audio={audio} from={mine ? (take?.loudestStart ?? 0) : 0.7} f0={f0} caption={caption} />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Recipe</h2>
            <Button type="button" variant="ghost" size="sm" onClick={copyRecipe}>
              <CopyIcon /> Copy
            </Button>
          </div>
          <pre className="rounded-lg border bg-scope p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {recipe}
          </pre>
        </div>

        <div
          className={cn("flex flex-col gap-2 rounded-lg p-4", stage >= 4 ? "bg-stage-4/10" : "bg-primary/5")}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn(STAGE_TONE[stage], "text-background")}>Stage {stage}</Badge>
            <span className="font-semibold">{STAGE_INFO[stage].name}</span>
          </div>
          <p className="text-sm">Gate: {STAGE_INFO[stage].gate}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
