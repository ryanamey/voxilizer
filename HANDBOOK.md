# Voxilizer Handbook

This is the single document to read before working on Voxilizer, from any account, with any assistant
or developer. It records **what we're building, why, every decision made so far, and exactly how to
resume**. `CLAUDE.md` is the short technical summary; this is the full story.

Last updated: 2026-10-28 · Status: MVP step 1 done (see §8).

---

## 1. Resuming the project (start here)

**If you're a new Claude session (or any AI assistant):**

1. Clone the repo and read, in order: this file → `CLAUDE.md` → `ROADMAP.md`.
2. Install and verify the baseline before changing anything:
   ```bash
   pnpm install
   pnpm test        # engine tests must pass (10 tests at step 1)
   pnpm typecheck
   pnpm lint
   pnpm build
   ```
3. Open `reference/grit-lab.html` in a browser. It's the original prototype and the reference for
   how every effect should sound and how the editor should feel.
4. Pick up the first unchecked item in `ROADMAP.md`. Section 9 below has the detailed plan for step 2.
5. When you finish a step: tick it in `ROADMAP.md`, update §8 of this handbook, and commit.

**Suggested first message for a new session:**
> "I'm continuing Voxilizer. Read HANDBOOK.md, CLAUDE.md and ROADMAP.md in the repo, run the checks,
> then continue with the next roadmap step."

**Who's who:** the founder is the product owner, architect and "the ears" (a musician who judges
whether a sound is right). The AI assistant writes the code. There is no other team yet, so keep
tooling minimal and explain decisions in plain language.

**Things the founder has that live outside the repo** (private to the original Claude account;
they may not be reachable from another account, which is why their content is summarised here):
- Research doc "The Science of Healthy Vocal Distortion" (Claude Docs artifact). Summary in §3.
- Grit Lab prototype artifact. A full copy is in `reference/grit-lab.html`.

---

## 2. The product

**One line:** Voxilizer lets singers design their vocal tone before they sing it, then train toward
it safely.

**The problem.** When working on a song, singers don't know where to put grit, growl or other effects.
They find out by singing the same phrase over and over with different settings. That burns hours of
high-effort, often distorted singing, which leads to fatigue and possible damage, often with nothing
gained. The founder has this problem himself.

**The solution.**
1. **Write the vocal line in a piano roll.** No staff notation (decided: a piano roll is easier and
   more practical for most singers). Each note gets a pitch, a length and a **vowel** (A E I O U).
   Typed lyrics were considered and dropped in favour of vowels per note.
2. **Shape the tone with handles:**
   - carrier **mode**: Neutral, Curbing, Overdrive, Edge
   - **effect**: creak, rattle, growl, grunt, with an amount 0–100
   - **false-fold distortion**: 0–100 (rock grit)
   - vocal tract: **larynx height**, **twang**, **air**, voice type (lower/higher)
   The song has one tone; any selection of notes can **override** it.
3. **Hear it instantly** through a synthesised voice. Experimenting costs zero vocal effort.
4. **See the load.** Every note shows its training stage (0–4). The song shows sung time, the share
   with effects, the heaviest stage, and warnings such as more than 6 s of rough singing without a
   clean note to recover on.
5. **Then train toward it** with staged lessons, and later record attempts and compare them to the
   designed target.

**Audience:** singers first, starting with rock/metal/soul singers who use rough effects. Possibly
coaches and producers later, then everyone.

**Principles that must not be broken:**
- The app never tells someone their technique is safe and never diagnoses. It flags warning signs
  and refers to a laryngologist (ENT with stroboscopy) or a voice speech-language pathologist.
- The synthesised preview shows a direction to aim for, not a sound to force. Copy should discourage
  pushing the voice to imitate it.
- Recordings stay on the user's device unless they explicitly choose to upload.
- Voice-cloning features only ever apply to the user's own voice. Reference recordings of other
  artists are analysed, never stored or redistributed.

---

## 3. Research summary (the science the product rests on)

**Core finding.** Healthy intentional distortion is a clean true-vocal-fold tone **plus an added
vibration source above the folds**. In imaging studies of trained singers the true folds keep
vibrating regularly underneath; mean pitch and mean contact don't change, only variability and noise
rise (McGlashan, Sayles & Sadolin 2013; Zangger Borch et al. 2004). Unhealthy distortion is noise
made by squeezing or slamming the true folds themselves.

**Where each effect comes from** (Complete Vocal Technique "levels"; Aaen, McGlashan & Sadolin 2017–2025):

| Level | Structure | Effects |
|---|---|---|
| 1 | True vocal folds | creak / vocal fry, air added, fry scream (highest risk) |
| 2 | False (ventricular) folds | distortion / grit, false-cord scream, throat-singing undertones |
| 3 | Arytenoids, cuneiforms, aryepiglottic folds, epiglottis | growl, rattle, grunt |
| 5 | Soft palate, uvula, tongue root | uvula / back-tongue rattle |

**Acoustic signatures the engine models:**
- Growl and undertones = **sub-harmonic at half the pitch** (period doubling). Tested in the engine.
- Grit = broadband noise between harmonics (lower harmonics-to-noise ratio).
- Twang = boosted ~3 kHz "singer's ring" from aryepiglottic narrowing.

**Key studies** (full citations in the research doc):
Titze 1998 · Zangger Borch, Sundberg et al. 2004 · McGlashan & Sadolin 2008 · McGlashan, Sayles &
Sadolin 2013 · Guzman et al. 2013 · Bailly et al. 2014 · Moisik & Esling 2014 · Aaen et al. 2017–2025
(incl. the 2025 ASHA supraglottic taxonomy) · University of Utah / Stark et al. 2024 (deathcore singer
Will Ramos: healthy folds, extreme supraglottic movement) · Perta, Zhang et al. 2026 (an
*uncontrolled* angry scream injured a trained singer's folds in one session, unlike trained belt) ·
Day, Tempesta, Howell, Aaen et al. 2026 (rough effects need higher threshold pressure; growl uses
more airflow).

**Evidence caveats.** Samples are small (10–32 trained singers) and much of the effect-mapping comes
from one group linked to Complete Vocal Institute. Almost no data on untrained, self-taught or
teenage singers, fry screams or inhale screams.

**Training stages** (encoded in `stageOf()`; prototype heuristics for coaches to refine):

| Stage | Content | Gate to move on |
|---|---|---|
| 0 | Foundations: regulated breath, false-fold retraction (silent laugh), clean onsets, a stable carrier mode, isolation, neck/jaw release | All six foundation tests pass |
| 1 | True-fold texture: creak, air added | Clear voice next morning |
| 2 | False-fold family: distortion, false-cord scream, undertones | Effect on/off without the clean note changing |
| 3 | Aryepiglottic family: growl, rattle, grunt | Each effect passes alone, no hoarseness |
| 4 | Integration: stacking sources, high amounts | Stamina for a full set |
| 5 | Advanced, with a coach: fry scream, inhale screams, hybrid high screams | — |

Hoarseness or pain means step back a stage. The universal learning loop for any effect: find it
silently → unvoiced → spoken → on a carrier (clean → effect → clean) → expand one variable at a time
→ apply in a song → check recovery 5 minutes later and the next morning.

**Health rules for the app:** dose effect time like strength training (start 5–10 min, add 2–3 min a
week only if the voice is clear next morning); interleave clean/SOVT reps; daily check-in (speaking
voice, soft high note, pain); two weeks of hoarseness or any pain → referral screen.

---

## 4. Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-10-27 | Research first, then an app with a step-by-step path | Founder's original goal: a scientific, healthy approach to all distortions |
| 2026-10-27 | Add a sound designer with handles | Lets singers hear a target tone without singing |
| 2026-10-27 | "My voice" mode (record a take, add effects via LPC) prototyped | Make previews sound like the user; kept as a later feature |
| 2026-10-28 | Core workflow = design the song's tone before singing it | Solves the founder's real problem: trial-and-error that burns the voice |
| 2026-10-28 | Notation input with a vowel per note instead of lyrics | No vocal effort at all; precise per-note control |
| 2026-10-28 | **Piano roll, not staff** | Easier and more practical (founder confirmed) |
| 2026-10-28 | Planned: one-time **voice profile** (5 vowels) | So synthesised playback sounds roughly like the singer |
| 2026-10-28 | Stack: Next.js, shadcn, Neon + Better Auth, Vercel, Sentry, Zod + Drizzle, Zustand | Founder's preference; modern and well supported |
| 2026-10-28 | Audio: Web Audio + AudioWorklet, Web Worker rendering, versioned Zod song format | Standard, robust browser audio architecture |
| 2026-10-28 | **Engine in TypeScript first, Rust/WASM later** | Two-person team; founder can own TypeScript; port only when live feedback/native apps/plugins need it |
| 2026-10-28 | Add other tools only when a step needs them | Every tool is maintenance for a tiny team |
| 2026-10-28 | Name: **Voxilizer** (working name) | Coined, all domains free, no direct conflict found |
| 2026-10-28 | Repo `ryanamey/voxilizer`, pnpm workspace `apps/web` + `packages/engine` | Simple monorepo; engine isolated for testing and future porting |

**Names considered and rejected:** VoxDesign (voxdesign.com taken; "Vox" overlaps the VOX amp brand),
VocalDesign (Roland sells "Vocal Designer"), VoxShape, VoxSketch, VoxPalette, Raspwell, Supravox,
FalseFold, Vocalyre/VoxLyre (lyrebird idea), VoxTrill, Vocanary.

---

## 5. Branding and legal to-dos

- [ ] Register **voxilizer.com**, **voxilizer.app** and **voxiliser.com** (all free on 2026-10-28).
- [ ] Trademark search (CIPO for Canada, USPTO for the US) before spending on branding.
- [ ] Decide whether to license Complete Vocal Technique terms (Neutral, Curbing, Overdrive, Edge) or
      rename the modes with neutral, physiology-based names.
- [ ] Recruit an advisor: laryngologist or voice SLP.
- [ ] Privacy policy compliant with PIPEDA (Canada) and GDPR before storing any recordings.

---

## 6. Architecture

```
voxilizer/
  apps/web/                 Next.js 16 app (App Router, Turbopack, React 19, Tailwind v4)
    next.config.ts          COOP/COEP headers (cross-origin isolation)
    public/worklets/player.js   AudioWorklet playback processor (plain JS)
    src/audio/audio-engine.ts   AudioContext + worklet + worker host
    src/audio/render.worker.ts  runs the engine off the main thread
    src/app/studio/         /studio page (step-1 demo)
  packages/engine/          @voxilizer/engine, pure TypeScript
    src/constants.ts        modes, effects, vowels, voices (the sound's numbers)
    src/song.ts             versioned Zod song schema + example song
    src/render.ts           source–filter melody synthesis
    src/load.ts             training stages and load analysis
    src/__tests__/          Vitest tests
  reference/grit-lab.html   original prototype
```

**Threads:** UI on the main thread → render request to the **Web Worker**, which runs the engine at
the AudioContext's sample rate → samples transferred to the **AudioWorklet**, which plays them and
reports position ~30×/s for the playhead.

**Engine model (render.ts):**
- Source: one Rosenberg-style glottal pulse per cycle; mode sets open quotient, closing sharpness,
  spectral tilt, gain and aspiration.
- Effects: false folds → noise burst after each closure; growl → flutter every other cycle
  (sub-harmonic); creak → irregular long, weak pulses; rattle → random wet bursts; grunt → slack
  folds plus gated turbulence.
- Filter: five cascaded formant resonators (vowel × voice scale × larynx × twang) plus a parallel
  3 kHz ring resonator; DC-blocked; gentle levelling; normalised to 0.85 peak.
- Melody: control values per 64-sample block, smoothed between notes (pitch glide ~30 ms, formants
  ~45 ms, effects ~50 ms), vibrato blooming after 0.35 s on held notes, re-articulation dip on
  repeated pitches. Seeded RNG makes renders deterministic.

**Rules:**
- Keep `packages/engine` free of DOM and React code.
- Changing anything in `constants.ts` or `render.ts` changes how every song sounds: do it deliberately
  and say so in the commit.
- Bump the song `version` on breaking schema changes and keep old versions loadable.
- Next.js 16 has breaking changes: read `apps/web/AGENTS.md` and `node_modules/next/dist/docs/`
  before using unfamiliar APIs.
- Fonts are self-hosted (`geist` package); with COEP on, any cross-origin resource needs CORP/CORS.

---

## 7. Stack

| Now | Add when a step needs it | Later |
|---|---|---|
| Next.js 16, React 19, TypeScript strict, Tailwind v4, Zod, pnpm workspace, Vitest, Vercel | shadcn/ui, Zustand + zundo (editor state + undo), IndexedDB (local-first songs), Neon + Drizzle, Better Auth, Sentry, Stripe, Cloudflare R2 (recordings), ONNX Runtime Web (ML pitch tracking) | Rust → WASM engine, PWA (Serwist), Capacitor mobile apps, nih-plug DAW plugin, GPU service for neural voice rendering |

**Deploying:** import the repo in Vercel and set **Root Directory = `apps/web`**.

---

## 8. Current status

**Done (step 1):** workspace, engine port with 10 passing tests (including a growl sub-harmonic check),
worker rendering, AudioWorklet playback, `/studio` page with playhead and load summary, COOP/COEP
headers. Verified in headless Chromium: page is cross-origin isolated; the 10.9 s example renders in
~180 ms. Nobody has listened to it through speakers yet.

**Blocked:** pushing to GitHub. The Claude GitHub app was installed only on the `oqtoboost`
organisation, not on the `ryanamey` account that owns the repo. Fix: github.com/apps/claude →
Configure → choose `ryanamey` → select `voxilizer`. A zip of the first commit was given to the
founder as a backup.

---

## 9. Next: step 2 plan (studio editor)

Port the Grit Lab editor into the app as React components:

1. **Song store** (Zustand + zundo): song JSON matching `SongSchema`, selection, undo/redo.
2. **Piano roll** (canvas): add / move / resize / multi-select / delete / arrow-key nudge, vowel
   letter on each note, stage stripe, override dot, playhead. Match Grit Lab's interactions.
3. **Tone panel**: song tone and per-note override (mode, effect, amount, false-fold), vowel picker,
   "Follow song tone" toggle; voice settings (voice, larynx, twang, air).
4. **Live load map** from `analyzeLoad()`: per-note stripe bar plus summary and warnings.
5. **Quick preview**: play the selection or a single note through `renderTone`/`renderMelody`.
6. **Local saving** in IndexedDB, validated with `parseSong`, plus JSON import/export.
7. Add **shadcn/ui** for panels, sliders and menus.
8. Tests: store reducers, overlap resolution, schema round-trip; a Playwright smoke test for the editor.

Then steps 3–6 per `ROADMAP.md`.

---

## 10. Open questions

- Final name and trademark clearance.
- License CVT mode names or rename them?
- First paying user: self-taught singers, or coaches with students?
- Monetisation model (subscription, per-coach seats, one-off).
- How realistic must playback be before launch? (Synth now; voice profile in step 4; neural later.)
