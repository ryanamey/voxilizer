# Roadmap

## MVP

- [x] **1. Skeleton and audio plumbing.** pnpm workspace, Next.js app, `@voxilizer/engine` ported
      from the prototype with tests, Web Worker rendering, AudioWorklet playback, COOP/COEP headers.
- [ ] **2. Studio editor.** Port Grit Lab's sound designer and melody studio into the app: editable
      piano roll, vowels per note, song tone + per-note overrides, live load map, quick single-note
      preview, undo/redo. Songs saved locally (IndexedDB).
- [ ] **3. Accounts and saved songs.** Better Auth, Neon + Drizzle, songs synced as JSON.
- [ ] **4. Voice profile.** Record five vowels once; melody playback uses the singer's own vowel
      colours and timbre.
- [ ] **5. Record and compare.** Record an attempt per section; compare its tone fingerprint
      (pitch stability, noise, roughness, sub-harmonics, brightness, ring) to the designed target.
- [ ] **6. Lessons, stages 0–2.** Foundations, creak, false-fold distortion, with daily check-ins
      and effect-time tracking.

## Later

Stages 3–5 content · effect classifier (ML) · coach dashboard · live meters while singing ·
neural "your voice" rendering · mobile apps · DAW plugin.
