import Link from "next/link";
import {
  ArrowRightIcon,
  AudioWaveformIcon,
  PianoIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/** A static picture of the melody studio: notes with vowels and training-stage stripes. */
const DEMO_NOTES = [
  { x: 0, y: 6, w: 4, v: "A", s: "clean" },
  { x: 4, y: 4, w: 2, v: "E", s: "clean" },
  { x: 6, y: 3, w: 2, v: "A", s: "clean" },
  { x: 8, y: 1, w: 6, v: "O", s: "clean" },
  { x: 16, y: 3, w: 2, v: "I", s: "clean" },
  { x: 18, y: 4, w: 2, v: "A", s: "clean" },
  { x: 20, y: 6, w: 8, v: "A", s: "3" },
  { x: 32, y: 4, w: 2, v: "E", s: "clean" },
  { x: 34, y: 2, w: 4, v: "A", s: "2" },
  { x: 38, y: 0, w: 8, v: "O", s: "2" },
  { x: 48, y: 3, w: 4, v: "A", s: "clean" },
  { x: 52, y: 6, w: 8, v: "O", s: "4" },
] as const;

const STAGE_BG = {
  clean: "bg-stage-clean",
  "2": "bg-stage-2",
  "3": "bg-stage-3",
  "4": "bg-stage-4",
} as const;

function StudioPreview() {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm" aria-hidden="true">
      <div className="flex items-center gap-2 border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        <span className="size-2.5 rounded-full bg-stage-4/80" />
        <span className="size-2.5 rounded-full bg-stage-3/80" />
        <span className="size-2.5 rounded-full bg-stage-clean/80" />
        <span className="ml-2">Chorus · 92 BPM · Curbing</span>
      </div>
      <div className="relative h-52 bg-scope sm:h-60">
        {Array.from({ length: 16 }, (_, i) => (
          <div
            key={i}
            className="absolute inset-y-0 border-l border-border/60"
            style={{ left: `${(i / 16) * 100}%` }}
          />
        ))}
        {DEMO_NOTES.map((n, i) => (
          <div
            key={i}
            className="absolute overflow-hidden rounded-[4px] bg-primary font-mono text-[10px] leading-none font-semibold text-primary-foreground"
            style={{
              left: `${(n.x / 64) * 100}%`,
              width: `calc(${(n.w / 64) * 100}% - 3px)`,
              top: `${12 + n.y * 11}%`,
              height: "9%",
            }}
          >
            <span className="absolute top-1/2 left-1 -translate-y-1/2">{n.v}</span>
            <span className={`absolute inset-x-0 bottom-0 h-[3px] ${STAGE_BG[n.s]}`} />
          </div>
        ))}
        <div className="absolute inset-y-0 w-0.5 bg-stage-4" style={{ left: "47%" }} />
      </div>
      <div className="flex h-3 border-t">
        {DEMO_NOTES.map((n, i) => (
          <span key={i} className={`${STAGE_BG[n.s]} h-full`} style={{ width: `${(n.w / 64) * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

const STEPS = [
  {
    icon: PianoIcon,
    title: "Write the vocal line",
    body: "Draw your melody in a piano roll and give every note its vowel. No sheet music needed.",
  },
  {
    icon: SlidersHorizontalIcon,
    title: "Shape the tone",
    body: "Pick the carrier mode, then dial in false-fold grit, growl, rattle, twang and air, for the whole song or one note.",
  },
  {
    icon: AudioWaveformIcon,
    title: "Hear it before you sing it",
    body: "Play it back instantly. Try ten versions of a chorus without singing a single take.",
  },
] as const;

const STAGES = [
  { n: "0", name: "Foundations", body: "Breath, false-fold release, clean onsets", tone: "bg-stage-clean" },
  { n: "1", name: "True-fold texture", body: "Creak and air, effortless", tone: "bg-stage-clean" },
  { n: "2", name: "False-fold family", body: "Distortion, false-cord grit, undertones", tone: "bg-stage-2" },
  { n: "3", name: "Aryepiglottic family", body: "Growl, rattle, grunt", tone: "bg-stage-3" },
  { n: "4", name: "Integration", body: "Stacked effects and high amounts", tone: "bg-stage-4" },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pt-24">
        <div className="flex flex-col gap-6">
          <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
            For singers who use grit
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Design your vocal tone before you sing it.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Stop burning your voice on take after take to find the right sound. Voxilizer lets you place
            growl, grit and twang on every note of your song, hear it instantly, then train toward it one
            healthy stage at a time.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">
                Start designing <ArrowRightIcon />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/#how-it-works">See how it works</Link>
            </Button>
          </div>
        </div>
        <StudioPreview />
      </section>

      <section id="how-it-works" className="scroll-mt-16 border-y bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">
            Zero vocal effort until you know what you want
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            The experimenting happens on screen, not in your throat.
          </p>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-3 rounded-xl border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="size-5" />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">Step {i + 1}</span>
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="healthy-by-design"
        className="mx-auto grid w-full max-w-6xl scroll-mt-16 gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2"
      >
        <div className="flex flex-col gap-4">
          <span className="flex size-10 items-center justify-center rounded-lg bg-stage-clean/15 text-stage-clean">
            <ShieldCheckIcon className="size-5" />
          </span>
          <h2 className="text-3xl font-bold tracking-tight">Healthy by design</h2>
          <p className="text-muted-foreground">
            Voice research shows healthy distortion is a clean tone underneath plus an added vibration above
            the vocal folds. Voxilizer is built on that. Every note shows its training stage, and every song
            shows its vocal load, so you can see when a passage needs a clean phrase to recover.
          </p>
          <p className="text-sm text-muted-foreground">
            Voxilizer is a training tool, not a medical device. It never tells you a technique is safe for
            you.
          </p>
        </div>
        <ol className="flex flex-col gap-3" aria-label="Training stages">
          {STAGES.map((s) => (
            <li key={s.n} className="flex items-center gap-4 rounded-lg border bg-card p-4">
              <span
                className={`${s.tone} flex size-8 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold text-background`}
              >
                {s.n}
              </span>
              <div className="min-w-0">
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Find your tone tonight. Save your voice for the show.
            </h2>
            <p className="mt-2 text-muted-foreground">Free while in early access.</p>
          </div>
          <Button asChild size="lg">
            <Link href="/sign-up">
              Create your account <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
