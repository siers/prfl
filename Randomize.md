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
| `-=- name` | written order | nowhere (or subdeck `name/`) | `block('name')` |
| `--- name` | **shuffled** | nowhere (or subdeck `name/`) | `block('name')` |

**`---` shuffles, `-=-` keeps order.** One character, inverted meaning, no
mnemonic — this is the easiest thing in the language to get wrong.

A *named* block goes nowhere on its own: it's a definition, called from an
expression.

**A header's name is an item line.** Whitespace after the marker is dropped and
the rest is parsed and evaluated exactly like an item — `{}`, `[]` with tags,
`Key: description` — except for the `Nx` multiplier. The line's
[key](#line-keys) names the block; without a `Key:` prefix, the first word is
the key and the whole text is the description:

```
-=- scales: three octaves      # key scales
-=- warmup for today           # key warmup
-=- Key-{keys()}: [k]          # key Key-<first key>
```

Only the first line an explode yields counts; none (`{after(…)}` gating) drops
the block entirely. Headers are evaluated where they stand, so they see globals
assigned above them, and they're evaluated **once**, with the root deck: the
evaluated headers are kept in state, and instantiating a subdeck reuses them
rather than re-rolling the names.

**Subdecks come from blocks.** An item whose key equals a named block's name
gets a 📂: entering it instantiates the subdeck `name/` from that block, ordered
like `scheduleBlocks('name')` (least-recently-reviewed first) — unless its
[order](#block-order) says otherwise. It's lazy — the
block is evaluated on 📂, not on 🔄. To do that the whole text is re-evaluated, so
the block sees every block and global — but randomly assigned globals (e.g.
`keyz`) are rolled again and can differ from what the root deck shows. A live deck
is re-entered as-is; an exhausted or 🧹-cleaned one is instantiated fresh. Items
inside a subdeck can open their own block subdecks the same way. `name*` puts the
block's lines inline instead, ordered exactly as entering its subdeck would —
including the order. It's a key, so
it fits a key list (`Scales, warmup*`) and takes a multiplier and `name::`. A block whose
lines need a `prefix:` keeps a wrapper: `-=- Standards` → `{scheduleBlocks('St:StandardsT')}`.

<a id="block-order"></a>**`#scheduled` / `#shuffled` / `#unscheduled` / `#unscheduleNew` set a block's order.** They're
mutually exclusive, and on a header they override the marker:

| Order | Lines | Subdeck / `name*` |
|---|---|---|
| `#scheduled` | per marker | least-recently-reviewed first |
| `#shuffled` | shuffled, even for `-=-` | as shuffled |
| `#unscheduled` | as written, even for `---` | as written |
| `#unscheduleNew` | per marker | never-reviewed first, in block order; then least-recently-reviewed first |

Without one, a subdeck is scheduled and `block('name')` follows the marker —
`block()` never schedule-sorts; `scheduleBlocks()` does. Each is shorthand for
an `order` field, the named value first: `#scheduled` is
`` [s(`scheduled unscheduled`)]order `` (no `shuffled` to rotate to), `#shuffled` is
`` [s(`shuffled unscheduled scheduled`)]order ``, `#unscheduled` is
`` [s(`unscheduled scheduled shuffled`)]order ``, `#unscheduleNew` is
`` [s(`unscheduleNew scheduled unscheduled`)]order `` — the block follows the first
value, and only that value shows (`show-1`, unless a `show` flag is given).
Flags carry over (`#unscheduled:hide`). On the item pointing at a block
(`warmup: #shuffled`) they decide that item's subdeck, over the header — rotate
the field to switch. A live subdeck is re-entered as-is, so a switch shows on
the next fresh instantiation.

**`name::` moves a line into a block.** `warmup::Thing: do this`, written
anywhere, is appended to the end of the first block whose header is written
`warmup` — as `Thing: do this`. The name is matched against the header as
written, before evaluation, so a header named by `{}`/`[]` can't be targeted.
Without a written block, the lines make a `-=- name` block of their own, placed
before everything else so any block can call it: `-=- block` holding
`another::thing` gives `{scheduleBlocks('another')}` a block to schedule. A multiplier goes
in front: `2x warmup::Thing`.

**`::` with no name defines a card.** `::Scales: [key] three octaves` goes to
no block at all: it's evaluated into the card store under its key, with nothing
placed in any deck. A line that is just the key — `Scales:` or a bare `Scales`
— points at it, from the root deck, a block subdeck or the insert action:

```
-=-
warmup
Scales:                      # shows "Scales: [G] three octaves"
-=- warmup
Scales                       # the same card
::Scales: [key] three octaves
```

Several pointers fit on one line: a line of nothing but comma-separated keys
— `Scales, Arps:, Bowing` — is one line per key, in that order. A multiplier
and a `name::` prefix apply to each (`2x warmup::Scales, Arps`). Anything else
on the line (`Scales: slow, legato`) keeps it a single ordinary line.

A bare key never replaces a stored card; it's only a card of its own while its
key has none. A definition replaces any line with its key, wherever either is
written — the first definition per key wins. Definitions are evaluated after
every block, in written order, so they see globals as the blocks left them.
`{}` works as anywhere (`::Key-{keys()}: …` defines one card per key). Inserting
a definition updates that card everywhere it's pointed at and adds no item.

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

Every item has a key, and items with the same key are one card: a re-roll
shows on each, and a [definition](#headers-and-blocks) can stand in for all of
them. A line without one gets `Nr` and 6 hex digits of a hash
of the line as written — after `{}` explodes, before `[]` rolls — so a re-roll
keeps the key and each exploded line gets its own. Identical lines (`2x`
included) share it. Headers don't take a hash key: their first word names the
block.

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
{scheduleBlocks('scales-3%50 shifting%0')}
```

Each whitespace-separated token is `[prefix:]name[-count][%shuffleFactor]`. Omitting the count
takes the whole block; `-N` takes N after sorting least-recently-reviewed first;
`-0` takes none. A `prefix:` prepends `prefix-` to both key and contents, so
reviews record under the rendered key. A line starting with `-` opts out:
instead of being prefixed, its leading `-` is stripped (`-shared: …` → `shared: …`).

The order is that sorted list, jittered: every item moves fewer than
ceil(`shuffleFactor`% of the block) places, the most in the middle and tapering
towards the ends, so the oldest and newest stay put about 80-85% of the time.
The default is 100: in a 20-item block items move about 1.6 places on average,
at most 8. Blocks under about 8 items get a boost that fades with size, so a
4-item block still reorders about half the time. `%0` is strict
oldest-first; `%50` is calmer.

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

Six actions, all swipes on the item card:

| Swipe | Action | Memory | Order |
|---|---|---|---|
| **E** → | review ✅ | `{reviewed: now, bpm}`, accepted review if timer ≥ 10 s | — |
| far **E** →→ | review + FSRS 🧠 | as review; `fsrs: now` the first time | — |
| **W** ← | suspend 📚 | unaccepted review if timer > 3 min | — |
| far **W** ←← | ban 🚫 | `banned: true` | — |
| **N** ↑ | surface 🌟 | `reviewed: 0`, `dropped: 0`, unbanned | **to top** |
| **S** ↓ | bury ✘ | unaccepted review if timer > 3 min | **drops down** |

Review marks done and records *when* and *at what bpm*. Suspend marks done
**without** recording practice — hidden, but not counted as done. Surface undoes
a review and pulls the item back to the front.

Each card also keeps its history in `reviews`, oldest first: `{time, length,
accepted}`, where `length` is the ms on the item's own timer. A review appends
an accepted one if the timer reached ten seconds — `reviewed` is set either
way. Suspend and bury append an unaccepted one only if the item's
timer is past three minutes — a long try that didn't land — and otherwise
record nothing.

**FSRS is opt-in per card.** The far right swipe reviews the card and, the first
time and after a confirmation, turns on [FSRS](https://github.com/open-spaced-repetition/ts-fsrs) for it
(`fsrs: <opt-in time>`) — meant for cards that are strong, atomic and stable.
After that it's just a review. FSRS state isn't stored: it's replayed from the
card's `reviews` since the opt-in, accepted as Good and unaccepted as Again,
with learning steps off. An FSRS card not yet due starts out done, like a banned
one; scheduling puts the due ones first, most overdue first. Every other card
is still scheduled by `reviewed`.

Ban asks for confirmation first, then marks done like suspend, but the ban
sticks to the card: wherever the key shows up again — re-eval, reload, spawned
or entered decks, inserts — it starts out done. Surfacing a banned item lifts the ban.

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

Review state lives in a serialized map of `key -> {reviewed, bpm, reviews, fsrs}`, which is
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
#tag                   # shorthand for []tag: a tag with no value
#tag:flag
```

`#tag` only counts at the start of a word — `Key#2` and `a#b` stay text — and
a `#` at column 0 is still a comment.

**The first `:`-segment is the field's NAME, not a flag.** `[x]freeze` creates a
field *called* "freeze" and freezes nothing; you want `[x]key:freeze`. There is
no validation, so a mistake here is silent.

Tag names matter beyond identity: `metro` pins the bpm (and is
overwritten when you change the tempo — 🔄 restores the authored value), `tones`/`sheet` feed the
synth and engraver, a name containing `image` contributes an image, `br`
(`[…]br` or `#br`) prints nothing but ends the visual line, and `next`
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
| `nonrotated` | held still by ⏩ but re-rolled by 🔄; clicking its own tag still rotates it |
| `hide` | renders nothing, but still exists — feeds sheet/tones/image and stays re-rollable |
| `covered` / `covered-xyz` | prints `[name]` (or `[xyz]`) instead of the value — which still feeds sheet/tones/image and stays re-rollable |
| `inline` | `<span>` instead of `<div>` — stays on the same visual line |
| `mono` | monospace |
| `br` | a tag *name*, not a flag — `[…]br` or `#br` prints nothing but ends the visual line |
| `cut-semi` | each value cut at the first `;` for display |
| `show-N` | show the first N upcoming values — a peek at the rotation queue |
| `maxlen-N` | override the 50-char truncation |
| `tones` | on a `sheet` field: also sound it through the metro (a field *named* `tones` sounds anyway) |
| `stable` | on spawn, not a parameter: every child deck carries the field's full value list as-is, instead of one value per combination |
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
reads as written. A one-click step (`1f`, `1s`) shows no count at all — it fires
on the click that reaches it, so there's nothing to count down — and renders as
the bare letter: `1f 4r` -> `4r f`. A parked `1s` stays `s` as well.

A programme rotates **forever** unless it ends in `s`. `[4f 4r 8s]next` steps
twice then parks on the `s` permanently, swallowing further clicks without
firing — `0:4s` is what a halted programme looks like. The metronome keeps
clicking and the rest of the card is untouched; only parameter-stepping stops.
Rotating the `next` field by hand (⏩ on the tag itself) moves the spent `s` to
the back and the programme resumes.

Note that a global ⏩ deliberately **skips** the `next` field — otherwise
stepping the item would also step its own programme.

The programme requires the metronome powered, since clicks are what drive it.
