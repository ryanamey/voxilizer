# CVT: updates since the 2012 book (app chapter)

Paraphrased notes from the CVT app chapter "Updates in relation to the English book edition from 2012" (the founder's 26 screenshots in `sources\me` on the founder's PC, not in git). Companion to `reading-notes-2012.md`. Where the two disagree, Voxilizer follows this file.

## Density (new parameter)

- Each mode can be sung in **fuller** or **reduced** density, and Neutral also in **falsetto**.
- Fuller = clear, open; reduced = contained, "held-in"; falsetto = thin, hollow, "disengaged" singing. Fuller and reduced are both "engaged" singing.
- **Curbing is always reduced** (or very reduced) density.
- Overdrive and Edge in reduced density sit at **medium volume** and have a more contained character. They use the same vowels as fuller density.
- Reduced density does not change the sound colour.
- Vocal breaks always go to or from **Neutral in falsetto** (replaces the 2012 idea of "flageolet below high C").

## Modes

- Overdrive upper limit for women is lowered from E♭5 to **D5**. Men stay at C5.
- Curbing vowels are now **UH, O, OO** (2012: I, O, UH). I can still be sung in Curbing but isn't taught as a Curbing vowel. UH is a "wide" vowel that takes in many vowels.
- Curbing works in all pitches, except for women above high C (C6).
- Neutral: medium volume (4–7) is possible in the middle part when combined with plenty of twang; loud (7–10) only in the high part.
- **Metal-like Neutral** and the **assisting mode** are dropped.

## Transitions

- **Highway**: fuller density (fuller Overdrive/Edge ↔ fuller Neutral).
- **Byway**: reduced density, through Curbing (reduced Overdrive/Edge → Curbing → reduced Neutral).

## Vowels: exact vs wide

- Curbing: exact O, OO; wide UH.
- Overdrive: exact EH, OH.
- Edge: exact I, EH; wide A, OE.

## Sound colour

- Five grades: Lightest, Lighter, Mid, Darker, Darkest.
- "Lowered palate" is now "relaxed palate".

## Effects and terminology

- 10 main effects; the others are combinations. Full distortion = distortion + creaking + rattle + growl.
- "Attack" is now **onset**; "Air added" / "with air" is now **audible air**.
- Support is described as a balance: more or less support energy.

## What Voxilizer implements (commit 94899a7)

- Optional density per tone; checks for the D5 limit, Curbing vowels and women above C6, density-aware volume ranges, Highway/Byway and vocal-break tips. The assisting-mode rule is removed.
- Synth: reduced density opens the folds slightly and halves the 3 kHz ring; falsetto is thin, breathy and has no ring.
- Not yet: the five colour grades, the 10-effect model, onset types, support balance.
