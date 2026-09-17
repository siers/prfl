# Map

Where things live, and which file to open first.

`README.md` says what this is and why. [`Randomize.md`](Randomize.md) and
[`ToneLib.md`](ToneLib.md) are the two deep references. This file is the index
between them: it answers "where does this behaviour live" rather than "how does
it work".

---

## 1. The shape of the thing

A practice list is a text file (`.rndl`). Evaluating it produces **render
lines** — concrete items with resolved parameters. The UI then walks those items
with timers, a metronome, sheet music and a review memory.

```
exercises/*.rndl                       the source you write
  │
  │  RandomizeLang.ts          parse + evaluate          ── helpers from RandomizeLangUtils.ts
  ▼                                                          (~100 fns + ToneLib in scope)
RenderLine[]                           items with resolved fields and tags
  │
  │  Randomize.tsx             the screen
  ▼
  ├── RandomizeState.ts        state machine: advance, review, spawn, metro
  ├── Decks.ts / RandomizeDecks.ts   queue, cursor, subdecks, parameter spawning
  ├── Timers.ts                total / per-deck / local
  ├── RandomizeNext.ts         the `next` programme, driven by metro clicks
  ├── Synth.tsx                `tones` → Tone.js
  └── SheetOSMD.tsx            `sheet` → SheetNotation → MusicXML → OSMD
```

The one asymmetry worth knowing up front: **evaluation is a library, the UI is a
consumer**. `scripts/rndl` renders a file to stdout with no React at all, which
makes the whole language testable and debuggable outside the browser.

---

## 2. Entry points

| Want to | Open |
|---|---|
| Render a `.rndl` to stdout | `scripts/rndl` → `evalContentsS` |
| See it in the browser | `npm run dev`, program `randomize` |
| Add a program to the app | `src/Programs.jsx` (the registry) |
| Change the top-level shell | `src/App.jsx` — keyboard, program switch, persisted state |

`npm run build:rndl` bundles the CLI to `.bin/rndl.mjs` so plain `node` can run
it from any cwd. That build strips types without checking them — `npm run
typecheck` is the separate gate.

---

## 3. The language — `src/programs/`

Read [`Randomize.md`](Randomize.md) for semantics. The file layout:

| File | Holds |
|---|---|
| `RandomizeLang.ts` | parse → evaluate → `RenderLine[]`. Explodes, interpolations, blocks, re-roll and rotation. |
| `RandomizeLangTypes.ts` | every type in the pipeline, plus the tag predicates (`isFrozen`, `isHidden`, `isSounded`, `showCount`, …) |
| `RandomizeLangUtils.ts` | the ~100 helpers in scope inside `[…]` and `{…}` |

**Where the tags are defined.** A flag like `freeze` or `hide` is one predicate
in `RandomizeLangTypes.ts`, and it is read in two places — the evaluator for
resolution order, the component for display. There is no validation: an
unrecognised flag is silently ignored, so a typo is invisible. That's the single
most common way to lose an hour here.

**Resolution order** is `freeze → textual → computed`, implemented in
`orderInterpolates`. `computed` fields resolve last and can read every other
field via `fields.<name>` — which is what lets one field on a line derive from
another.

**The two buttons are not the same axis.** 🔄 re-evaluates a line; ⏩ rotates each
field's value list by one. Four tags cut across them, and three of the pairings
are reachable: `freeze` survives a re-eval but still rotates, `nonrotated` is
re-rolled but held still by ⏩, and `computed` is re-derived by both rather than
holding a list of its own. Reaching for `freeze` when the intent was "don't step
this" is the easy mistake — it is the other one.

**The helper surface** is assembled in `randomizeLangUtils()` and returned as one
object; the tail of that return is the fastest way to see everything callable.
Grouped roughly: list building (`s`, `ss`, `times`, `range`, `indices`),
combinatorics (`shuffle`, `perm`, `comb`, `power`, `cross`, `divide`, `chunk`),
zips (`zipT`, `zipLongest`, `zipInterleave`, …), scheduling (`block`,
`blockLines`, `scheduleBlocks`, `pickTasksStateless`), music (`keys`,
`modeShifts`, `frets`, `scalePositions`, `metroS`), and the `ToneLib` /
`ToneLibViolin` namespaces whole.

Note there is **no `rotate` helper for lists** — `arrayRotate` is `arrayShift`
from `src/lib/Array.ts`, and rotation of a *field's* values is a UI action (⏩),
not a language one. Those are different rotations; conflating them is easy.

---

## 4. Runtime — `src/programs/`

| File | Holds |
|---|---|
| `Randomize.tsx` | the screen. Rendering, swipes, metro UI, re-roll buttons. The big one. |
| `RandomizeState.ts` | every reducer: `reduceRecalc`, `reduceSpawn`, `reduceTimer`, `reduceMetroClick`, deck enter/pop |
| `Decks.ts` | the queue primitives: cursor, seek, `deckDropThree` (burying), visibility |
| `RandomizeDecks.ts` | spawning a subdeck from a line's parameter space (`cartesian` / `zip`) |
| `Timers.ts` | the timer algebra — start/stop/subtract, `hm`/`ms` formatting |
| `RandomizeNext.ts` | the `next` programme: parse `4f 4r`, spend clicks, fire actions |
| `SwipeHandlers.tsx` | gesture → action |
| `Synth.tsx` | `SheetNote[]` → Tone.js events; `unlockAudio` for the mobile audio gate |

State is versioned (`currentStateVersion`) and persisted to `localStorage` by
`App.jsx`. Review memory is a serialized `key -> {reviewed, bpm}` map; items
never seen fall back to a stable hash of their contents, so ordering is
deterministic rather than arbitrary.

---

## 5. Music — `src/lib/`

| File | Holds |
|---|---|
| `ToneLib.ts` | notes, keys, intervals, transposition. See [`ToneLib.md`](ToneLib.md). |
| `ToneLibViolin.ts` | strings, positions, fingerings |
| `ToneLibFlashcards.ts` | flashcard generation over the above |
| `SheetNotation.ts` | the `` `c4 d4 e8 f8` `` mini-syntax → `SheetNote[]` |
| `MusicXML.tsx` | `SheetNote` → MusicXML elements (`note`, `rest`, `notesToMusic`) |
| `OpenSheetMusicDisplay.jsx` | the OSMD engraver wrapper |
| `Vexflow.jsx`, `ViolinNote.jsx` | alternate/auxiliary renderers |
| `Array.ts`, `Map.ts`, `Math.ts`, `Combinatorics.ts`, `Napkin.ts` | generic support |

### The sheet syntax

Documented in full in the header comment of `SheetNotation.ts` — that comment is
the spec, and it is worth reading before writing any sheet string. Summary: a
token is `<letter><accidentals><octave><duration><dots><bowing><marks>`, the
digit is always the **duration** (LilyPond denominator, so `4` is a quarter),
octave is `'`/`,`, duration carries over to the next token, `|` starts a
measure, `r` is a rest.

**The constraint that bites**: durations are single symbols. There are no ties
and no tuplets, so a run of sixteenths must land on one notehead or be split.
Reachable lengths are `1, 2, 3, 4, 6, 7, 8, 12, 14, 15, 16` (dots are unlimited,
so `2...` spells 15); **5, 9, 10, 11 and 13 have no spelling at all** and must
be broken across several notes. Anything generating rhythms has to know this.

---

## 6. Worked example: "a 4/4 sixteenth phrase and all its rotations"

The request: *each 16th randomly on/off at 3:1, bind adjacent hits into longer
notes, then emit every rotation.* Tracing it touches most of the map, so it's a
good orientation exercise.

1. **Where does it go?** `exercises/sheets.rndl` — that file is already the
   demonstration ground for the `sheet`/`tones` tags. Read its existing lines
   first; they document the tag combinations by example.

2. **Generating.** Pure JS inside `{…}` statement form (trailing `;`, emits
   nothing) to define helpers and roll the phrase once. Assignments become
   globals that persist for the rest of the evaluation — that's how one rolled
   phrase is shared across all 16 rotation lines instead of being re-rolled per
   line.

3. **Binding.** Adjacent on-slots merge into runs; each run becomes a note,
   each off-run a rest. Then the duration constraint from §5 applies: split any
   run whose length has no single spelling. Splitting on beat boundaries keeps
   the 4/4 pulse legible rather than emitting syncopations the engraver will
   beam confusingly.

4. **One line per rotation.** `{…}` explode — `Rot-{indices(16)}` produces 16
   lines, each with its own key, which is what gives each rotation independent
   review memory. Explodes are *not* re-rollable, which is correct here: the
   rotations are the material, not a parameter to shuffle.

5. **Engraving and hearing.** `[…]sheet:hide:tones` — `sheet` engraves,
   `hide` keeps the raw string off the card, `tones` opts the engraved line
   into being sounded. (A `tones` tag sounds without engraving; `sheet` alone is
   silent. The four combinations are exactly what the top of `sheets.rndl`
   demonstrates.)

6. **Reading the other fields.** A field that derives from another must be
   `computed`, so it resolves last and can see `fields.<name>`.

7. **Checking it.** `./scripts/rndl exercises/sheets.rndl` renders without the
   UI — faster than the browser, and it surfaces `error: …` lines instead of
   failing silently.

The general lesson: the language gives you *arbitrary JS with persistent
globals*, so generation is ordinary programming. The constraints that matter are
at the edges — what the sheet syntax can spell, and what tag makes a value
visible, audible, or merely present.

---

## 7. Tests

`npm test` (vitest). Tests sit beside their subject as `*.test.ts`. The
heavyweights — `RandomizeLang.test.js`, `RandomizeState.test.ts`,
`ToneLib.test.ts`, `SheetNotation.test.ts` — double as the real specification
for their modules, and are usually a faster read than the implementation.

`src/experiments/` is scratch work kept deliberately, not production code.

---

## 8. Everything else

| Path | What |
|---|---|
| `exercises/` | `.rndl` sources. `demo.rndl` curated, `full.rndl` the real session and richest example. |
| `notes/` | design notes and dead ends, dated |
| `scripts/` | `rndl` CLI, `build-rndl.js`, `build-sw.js` |
| `server/` | small express + lowdb sync backend |
| `public/`, `sw.js` | PWA assets and service worker |
| `trash/` | retired code kept for reference |
