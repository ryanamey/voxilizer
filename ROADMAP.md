# Roadmap

## MVP

- [x] **1. Skeleton and audio plumbing.** pnpm workspace, Next.js app, `@voxilizer/engine` ported
      from the prototype with tests, Web Worker rendering, AudioWorklet playback, COOP/COEP headers.
- [x] **2. Studio editor.** Grit Lab ported into the app: sound designer, My voice, editable piano
      roll, vowels per note, song tone + per-note overrides, live load map, previews, undo/redo.
- [x] **3. Website, accounts and saved songs.** Landing page, Neon Auth sign-up/sign-in, dashboard
      shell with sections, songs saved to the account (Neon + Drizzle).
- [x] **3a. CVT rules.** Volume, singer, 11 vowels, per-note CVT checks with fixes, synth calibrated
      against the CVT Sound Library.
- [ ] **3c. CVT current edition.** Density, falsetto, highway/byway transitions, updated vowels.
- [ ] **3b. Go live.** First live run on Neon, Vercel deployment, Sentry.
- [ ] **4. Voice profile.** Record five vowels once; melody playback uses the singer's own vowel
      colours and timbre.
- [ ] **5. Record and compare.** Record an attempt per section; compare its tone fingerprint
      (pitch stability, noise, roughness, sub-harmonics, brightness, ring) to the designed target.
- [ ] **6. Lessons, stages 0–2.** Foundations, creak, false-fold distortion, with daily check-ins
      and effect-time tracking.

## Later

Stages 3–5 content · effect classifier (ML) · coach dashboard · live meters while singing ·
neural "your voice" rendering · mobile apps · DAW plugin.
