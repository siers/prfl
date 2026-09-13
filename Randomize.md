# Randomize

The practice-list program: you write a list in a small language (`.rndl`), it
generates concrete items, and then you walk them with timers, a metronome and a
review memory that remembers what you've already done.

This document covers the parts that aren't legible from the source: the DSL, how
timers nest, how reviewing reorders the queue, how tags behave once they're on
screen, and the `next` programme.

`exercises/full.rndl` is the reference practice list — the richest real example.
`./scripts/rndl exercises/full.rndl` renders one to stdout without the UI.

---

## 1. The `.rndl` language

A file is a list of lines. Blank lines are dropped. Every line is a comment, a
header, or an item.

### Comments

```
# V, Warmup
```

`#` must be at **column 0** — no leading whitespace. A `#` mid-line is ordinary
text, so `Bassline: [keys()] # great` keeps the tail.

### Headers and blocks

Headers split the file into blocks. The marker is `-=-` or `---`, and the
difference is the single most important thing to remember:

| Syntax | Order | Lands in | Callable |
|---|---|---|---|
| `-=-` | written order | root deck | — |
| `---` | **shuffled** | root deck | — |
| `-=- name` | written order | nowhere | `block('name')` |
| `--- name` | **shuffled** | nowhere | `block('name')` |
| `-=- name::` | written order | subdeck `name/` | no |
| `--- name::` | **shuffled** | subdeck `name/` | no |

**`---` shuffles, `-=-` keeps order.** One character, inverted meaning, no
mnemonic — this is the easiest thing in the language to get wrong.

A *named* block goes nowhere on its own: it's a definition, called from an
expression. A `::` block is a subdeck — it emits into its own deck and is **not**
callable. Several `::` blocks sharing a name concatenate.

Blocks are registered in file order, so a block must be defined **before** the
block that calls it. Adjacent non-empty root blocks get a `---` separator line
between them automatically; that's output, not something you write.

### Item lines

Everything else. Two kinds of embedded expression, and the distinction is the
core of the language:

```
Scales: [key] three octaves        # [] interpolates — one line, a re-rollable blank
Bowing-{ss(`dim sixths ysaye`)}:   # {} explodes — one line per value
```

**`{expr}` — explode.** Evaluated once per line, *before* interpolations. The
result is a list, and each element becomes **its own output line**. Multiple
`{}` on a line multiply out. Explodes are **not** re-rollable — nothing records
them, so ⏩/🔄 can't touch them; only a full re-eval re-runs them.

What it accepts:

| Result | Effect |
|---|---|
| `RenderLine[]` | spliced in as-is, surrounding text discarded (`{scheduleBlocks(…)}`) |
| `string[]` | marker replaced per element |
| `string[][]` | each inner array joined with a space, wrapped in `[ ]` |
| `undefined` | **zero lines** — the line disappears |

That last row is load-bearing. It's how date-gating works:

```
{after('2026-04-05', '')}ShiftingSevcik: [key] Sevcik, no gliss
```

**`[expr]` — interpolate.** Evaluated after explodes, once per produced line.
Values render joined by spaces, truncated to 50 chars, wrapped in literal square
brackets. The template and the resolved values are kept on the line, which makes
it re-rollable — and makes the *whole value list* (not just the shown head) the
parameter space that deck-spawning expands.

### Statement form

If a command's text ends with `;` it's compiled as a function body instead of
`return <expr>`. It then returns `undefined` — which emits zero lines. That's
how assignments work:

```
{stops=`thirds fourths sixths octaves`;}    # sets a variable, prints nothing
{n=5;}
```

Assignments create ordinary JS globals that persist for the rest of the
evaluation, which is how `key`, `keys` and friends flow between blocks.

The `[expr]` form both assigns *and* renders: `[keyz=keys().slice(0, 1)]`.

### Line multipliers

`Nx ` at line start — digits, `x`, one mandatory space:

```
0x ShiftingSlides: [key]      # suppressed
2x Bowing: [ss(`GDAE`)]       # two copies, each re-rolled independently
```

Copies are made *before* evaluation, so they differ.

### Line keys

A rendered line starting with a word followed by `:` (or nothing) gets that word
as its **key**:

```
DoTheLaundry: do it     ->  key = DoTheLaundry
Scales3: [key] ...      ->  key = Scales3
```

The key is the identity used for review memory, scheduler ordering, and subdeck
prefixes. Keys are derived **after** substitution, so a key can contain an
exploded value — `Key-{pickKeys().flat()}` yields `Key-C`, `Key-G`, …

### Escaping

The extraction regexes are non-nesting and stop at the first unescaped closing
bracket. Inside `[…]` you must escape brackets:

```
[\[...ss(`G D A E`), ...ss(`GD DA AE`)\]]
{keyz.flatMap(k => { key = k; return block('warmup-key') \})}
```

### `scheduleBlocks` sentence syntax

```
{scheduleBlocks('scales scale-stops bowing shifting')}
{scheduleBlocks(`WFL:jazz-piece`)}
{scheduleBlocks('scales-0 shifting-0')}
```

Each whitespace-separated token is `[prefix:]name[-count]`. Omitting the count
takes the whole block; `-N` takes N after sorting least-recently-reviewed first;
`-0` takes none. A `prefix:` prepends `prefix-` to both key and contents, so
reviews record under the rendered key.

### The expression language

Arbitrary JavaScript, compiled with `new Function`. Errors become an
`error: …` line rather than crashing the file. In scope: ~100 helpers from
`RandomizeLangUtils.ts` (`s`, `ss`, `pick`, `shuffle`, `shuffleX`, `zip*`,
`divide`, `perm`, `pyramid`, `after`, `maybeEvery`, `metroS`, `frets`,
`block`, `blockLines`, `scheduleBlocks`, …), the `ToneLib` and `ToneLibViolin`
namespaces, `memory`, and — inside `[…]` only — `fields`.

---

## 2. Timers

Three levels run off one start/stop state.

- **Total** — the whole session. Grey, on the left. Formatted `h/m` above an
  hour, otherwise `m/s`.
- **Per-deck-item** — every item carries its own timer, and each ancestor cursor
  on the stack accumulates too.
- **Local** — the current item. Centre, and re-rendered every ~45 ms straight
  into the DOM, bypassing React.

When you're nested in a subdeck, the "global" figure on display is the *parent
item's* timer, not the session total.

Running-state flows **down** from the total: start or stop anything and every
level syncs. Elapsed length is tracked **per level**, which is what makes
subtraction meaningful.

| Command | Trigger | Effect |
|---|---|---|
| `start` / `stop` | tap the centre timer, ▶️, metro power-on | total + leaf; ancestors follow the total |
| `restart` | swipe **N** on the timer | zeroes the leaf only |
| `subtract-and-restart` | swipe **W** on the timer (⏪) | subtracts the current item's elapsed time from the total **and every ancestor**, then restarts the leaf |
| `local-as-global` | internal | run after every advance/spawn/enter/pop so a new leaf inherits the running state |

`subtract-and-restart` is the "I got distracted" button: the time you just
burned is removed from every level that counted it, not just the item.

Siblings of the cursor are always stopped. Changing item or deck in planning
mode stops the local timer.

---

## 3. Reviewing

Four actions, all swipes on the item card:

| Swipe | Action | Memory | Order |
|---|---|---|---|
| **E** → | review ✅ | `{reviewed: now, bpm}` | — |
| **W** ← | suspend 📚 | untouched | — |
| **N** ↑ | surface 🌟 | `reviewed: 0`, `dropped: 0` | **to top** |
| **S** ↓ | bury ✘ | untouched | **drops down** |

Review marks done and records *when* and *at what bpm*. Suspend marks done
**without** recording practice — hidden, but not counted as done. Surface undoes
a review and pulls the item back to the front.

### How burying actually works

This is the scheduling heart of the app. Burying increments the item's `dropped`
count and moves it down — but not by a fixed amount:

1. It moves past the next **three visible** items, where "visible" excludes
   items whose own `dropped` count trails the current item's by 2 or more.
2. But never above `bottomOfQueue`: the last visible index holding an item whose
   `dropped` trails by more than one.

The effect is that the **first** bury is an ordinary drop-three, but an item you
keep burying sinks below everything that hasn't had its turn yet — it stops
competing with fresh material instead of resurfacing every few items.

Review state lives in a serialized map of `key -> {reviewed, bpm}`, which is
what `scheduleBlocks` and the spawn scheduler sort on. Unseen items fall back to
a stable hash of their contents, so ordering is deterministic rather than
arbitrary.

Item colour reflects this: done and reviewed **over 12 hours ago** is red, done
is green, an accumulated timer past 180 s is orange, otherwise grey.

---

## 4. Tags in the UI

A tag is written immediately after a `]`:

```
[expr]tag
[expr]tag:flag:flag
[expr]:flag            # leading colon -> auto-named tag1, tag2, …
```

**The first `:`-segment is the field's NAME, not a flag.** `[x]freeze` creates a
field *called* "freeze" and freezes nothing; you want `[x]key:freeze`. There is
no validation, so a mistake here is silent.

Tag names matter beyond identity: `metro` pins the bpm, `tones`/`sheet` feed the
synth and engraver, a name containing `image` contributes an image, and `next`
drives the programme in §5.

### Resolution order — forward references

Interpolations don't resolve left to right. They resolve in **three tiers**:

```
freeze  ->  default (textual order)  ->  computed
```

Within a tier order is stable. Each interpolation sees every field resolved
before it via `fields.<name>`, so `computed` — resolving last — can read
everything on the line:

```
Scales3: [key]key:freeze:inline
         [shuffle(modeShifts(fields.key.at(0), …))]mode:cut-semi:show-4
         [shiftsMD(fields.mode.at(0), …)]:computed:show-1
```

`key` freezes first; `mode` reads `fields.key`; the last field reads
`fields.mode` and must be `computed` to be allowed to. (`frozen` is a
back-compat alias for the same map.)

### The flags

| Flag | Effect |
|---|---|
| `freeze` | resolves first and is **not re-executed** on re-roll — the prior value is reused |
| `computed` | resolves last, sees every other field; on ⏩ it is **re-derived**, not rotated |
| `hide` | renders nothing, but still exists — feeds sheet/tones/image and stays re-rollable |
| `inline` | `<span>` instead of `<div>` — stays on the same visual line |
| `mono` | monospace |
| `cut-semi` | each value cut at the first `;` for display |
| `show-N` | show the first N upcoming values — a peek at the rotation queue |
| `maxlen-N` | override the 50-char truncation |
| `ordered` | on spawn, keep parameter order instead of schedule-sorting |

Unrecognised flags are ignored silently.

### Re-rolling

| Control | Meaning |
|---|---|
| 🔄 | **fresh** — re-execute every non-frozen command |
| ⏩ | **next** — rotate each field's value list by one, *without* re-running |
| click a tag | rotate only that field |

The distinction matters: ⏩ walks deterministically through the values a field
already produced (which is what `show-N` lets you see coming), while 🔄 draws new
ones. `freeze` fields sit out both; `computed` fields are recalculated against
the post-rotation values so the line stays internally consistent.

---

## 5. The `next` programme

A field tagged `next` steps the item forward off the metronome. It never moves
the cursor — it presses the item's own re-roll buttons.

```
[`11f`]next
[s('1n ' + '16f '.repeat(4) + '4r')]next:hide
```

Each entry is a count and an action:

| Action | Meaning |
|---|---|
| `f` | press ⏩ — rotate every field to its next value |
| `r` | press 🔄 — re-roll fresh |
| `n` | idle, let the clicks pass |
| `s` | **halt** — the terminus |

Every metronome click spends one click of the head entry. When it's exhausted
its action fires and the entry rotates to the back, refilled. The fire happens
on the click that reaches the count, not the one after.

Spent clicks show in the rendered value, so the card is its own progress bar:

```
4f 4r  ->  3:1f 4r  ->  2:2f 4r  ->  1:3f 4r  ->  0:4f 4r  ->  4r 4f
```

Remaining before the colon, spent after; an untouched step drops the prefix and
reads as written.

A programme rotates **forever** unless it ends in `s`. `[4f 4r 8s]next` steps
twice then parks on the `s` permanently, swallowing further clicks without
firing — `0:4s` is what a halted programme looks like. The metronome keeps
clicking and the rest of the card is untouched; only parameter-stepping stops.
Rotating the `next` field by hand (⏩ on the tag itself) moves the spent `s` to
the back and the programme resumes.

Note that a global ⏩ deliberately **skips** the `next` field — otherwise
stepping the item would also step its own programme.

The programme requires the metronome powered, since clicks are what drive it.
