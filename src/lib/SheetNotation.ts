// A bare-bones serialized sheet-music syntax for `.rndl` lines, LilyPond-flavoured.
//
//   [`c4 d4 e8 f8 | g2 a'4 bes,4`]sheet:hide
//
// A token is `<letter><accidentals><octave marks><duration><dots><bowing><marks>`:
//
//   letter      a-g (case-insensitive)
//   accidentals `is`/`es` (LilyPond) or `#`/`b`, up to two — c#, cis, bes, ceses
//   octave      `'` up an octave, `,` down an octave, relative to octave 4
//   duration    LilyPond denominator: 1 = whole, 2 = half, 4 = quarter, 8, 16
//   dots        `.` multiplies the duration by 1.5 (a second dot by 1.75)
//   bowing      trailing `v` up-bow, `n` down-bow (or the glyphs `V` / `Π`)
//   colour      `[G]` `[D]` `[A]` `[E]` for the violin string of that name, a hex
//               colour `[#ff8800]`, or a keyword `[red]`. Colours the notehead only.
//   shape       `[x]` a crossed notehead. Shares the bracket with colour but is a
//               kind of its own, so `c4[x][G]` is a crossed head in the G colour;
//               it is `[x][x]` that repeats. `[X]` is not it — an uppercase letter
//               in brackets is a violin string, and `[E]` must stay the E string.
//   text        `{3}` a fingering, engraved beside the notehead. Any text without a
//               space is allowed — `{1}`, `{sulG}` — but it engraves as a fingering,
//               so keep it short. Tokens split on whitespace, so `{sul G}` is two
//               tokens and parses as neither.
//   rest        `r` in place of the letter (duration/dots still apply)
//   slur        `(` after a note opens a slur, `)` after one closes it, as in LilyPond:
//               `c8( d e f)` is four notes under one curve. A slur spans notes of any
//               pitch and changes no duration — it is a bowing/phrasing mark, where a
//               tie is one sustained note. Slurs nest, and both may sit on one note:
//               `c8( d) e8( f)`, or `c8() d8` for a slur opened and closed at once.
//   tie         trailing `~` binds this note to the next, as in LilyPond — `c4~ c4` is
//               one note held for two quarters. The tie is the last thing in the token,
//               after the marks: `c4[G](3)~`. Durations that no single symbol can spell
//               (5, 9, 10, 11, 13, 15 sixteenths) are written as tied pieces.
//
// Brackets are used because every letter is already spoken for: a-g are notes, `r`
// is a rest, `v`/`n` are bowings, `b` is a flat. Braces keep text out of the
// colour's `[...]`, so the two can be written in either order — `c4[G]{3}` and
// `c4{3}[G]` are the same note. Unlike duration, none of them carry over to the
// next token — all are marks on one note, not running state.
//
// Parentheses are the slur, and so cannot also be the text mark: `c4(3)` would be
// ambiguous between a fingering and a slur opening on a note. That is why the
// fingering is `{3}` here where LilyPond writes a bare `-3`.
//
// `<442hz>` names a frequency directly, for training differences finer than the
// 12-tone grid. Duration/dots follow the angle brackets — `<442hz>8.` — and the
// octave marks `'`/`,` are accepted but ignored, an absolute pitch having no use
// for them. Such a note is synth-only: it carries no letter to engrave.
//
// The digit is always the duration, so octave takes `'`/`,` instead.
// A token without a duration inherits the previous one's, as in LilyPond.
// `|` starts a new measure; an unparsable token is collected in `errors`.
import * as ToneLib from './ToneLib'

// MusicXML <divisions>: duration units per quarter note, so 4 bottoms out at a sixteenth.
export const DIVISIONS = 4

export type Bowing = 'up' | 'down'

// A MusicXML <notehead> glyph name, passed through to the engraver verbatim. Only
// the cross is spellable so far; MusicXML lists many more, and each is one entry here.
export type NoteheadShape = 'x'

// Matched before the colour palette, and case-sensitively: `[E]` is the E string,
// so a shape cannot claim an uppercase letter.
const noteheadShapes: Record<string, NoteheadShape> = { x: 'x' }

export type SheetNote = {
  note: ToneLib.Note | null // null = rest, or a pitch only `hz` can express
  hz?: number               // exact frequency, for synthesis; unengraveable
  duration: number          // in divisions
  bowing?: Bowing
  color?: string            // CSS colour for the notehead, already resolved from the palette
  shape?: NoteheadShape     // notehead glyph; absent means the ordinary oval
  text?: string             // fingering text, engraved beside the notehead
  tied?: boolean            // tied to the FOLLOWING note; the pair sounds as one
  slurStart?: number        // slurs opening on this note (`(`), for nesting
  slurStop?: number         // slurs closing on this note (`)`)
  slurOpensFirst?: boolean  // `c8()` — the opener was written before the closer, so the
                            // closer may take the slur this same note opened
}

export type SheetMeasure = SheetNote[]

export type SheetParse = {
  measures: SheetMeasure[]
  errors: string[]
}

const DEFAULT_OCTAVE = 4
const DEFAULT_DENOM = 4

export const stringColors: Record<string, string> = {
  G: '#d64700',
  D: '#005df2',
  A: '#ffb300',
  E: '#04d1bd',
}

// export const stringColors: Record<string, string> = {
//   G: '#C0392B', // red
//   D: '#E67E22', // orange
//   A: '#27AE60', // green
//   E: '#2980B9', // blue
// }

// MusicXML colours are `#RRGGBB` (optionally `#AARRGGBB`) in uppercase hex — the
// schema validates against that regex and silently drops anything else, so a CSS
// keyword would engrave as no colour at all. These are the keywords worth spelling,
// resolved here rather than left to be dropped downstream.
const namedColors: Record<string, string> = {
  black: '#000000', red: '#FF0000', green: '#008000', blue: '#0000FF',
  orange: '#FFA500', purple: '#800080', grey: '#808080', gray: '#808080',
}

const accidentalNames: Record<string, string> = {
  isis: '##', is: '#', eses: 'bb', es: 'b',
}

// `v`/`n` mirror the engraved glyphs; `d`/`u` would clash with note letters.
const bowings: Record<string, Bowing> = { v: 'up', '∨': 'up', n: 'down', 'Π': 'down' }

// The trailing marks: brackets `[...]` and a text `(...)`, in any order and each kind at
// most once. Matched as one repeatable group rather than a fixed sequence, so they
// commute; a repeat is caught when the marks are read, where it can be named in the error.
const marksSource = String.raw`(?<marks>(?:\[[^\][\s]*\]|\{[^{}]*\})*)`

// The tie and the slur brackets, after the marks. Matched as one class so they commute
// — `c4~(` and `c4(~` are the same note, as LilyPond writes the first and the marks
// before them already commute. Both slur kinds may appear, repeated: `c8)(` ends one
// slur and opens the next, `c8((` opens two (a phrase inside a phrase), and `c8()`
// opens and closes on the one note. The counting happens when the token is read.
const slurSource = String.raw`(?<slurs>[()~]*)`

// `<NNNhz>` with the same trailing duration/dots/bowing; `'`/`,` tolerated and dropped.
// The marks are matched so they can be reported, not silently treated as an unparsable token.
const hzPattern = new RegExp(
  String.raw`^<(?<hz>\d+(?:\.\d+)?)hz>(?<octaves>['’,]*)(?<denom>\d+)?(?<dots>\.*)(?<bowing>[vn∨Π])?` + marksSource + slurSource + String.raw`$`, 'i')

// `<letter><accidentals><octaves><duration><dots><bowing><marks>` — every part but the letter optional.
const tokenPattern = new RegExp(
  String.raw`^(?<letter>[a-gr])(?<accidentals>isis|is|eses|es|[#b]{1,2})?(?<octaves>['’,]*)(?<denom>\d+)?(?<dots>\.*)(?<bowing>[vn∨Π])?` + marksSource + slurSource + String.raw`$`, 'i')

export type Marks = { color?: string, shape?: NoteheadShape, text?: string }

const markNames: Record<keyof Marks, string> = { color: 'colour', shape: 'shape', text: 'text' }

// One of each kind, in whichever order they were written. A second of a kind is an
// error rather than a silent last-one-wins: both spellings were deliberate, and only
// the writer knows which they meant.
//
// Colour and shape share the `[...]` bracket, so which kind a bracket is depends on
// its content: a known shape name is a shape, anything else is a colour to resolve.
// That keeps `c4[x][G]` two marks rather than a repeat, at the price of `[x]` being
// unavailable as a colour — no loss, there being no colour by that name.
export function parseMarks(marks: string): [Marks, string[]] {
  const out: Marks = {}
  const errors: string[] = []

  // Assigned per branch rather than through a shared [key, value] pair: the union of
  // pairs loses which value type goes with which key, and only `shape` is narrow.
  const set = <K extends keyof Marks>(key: K, value: Marks[K]) => {
    if (out[key] !== undefined) errors.push(`repeated ${markNames[key]}: ${marks}`)
    else out[key] = value
  }

  for (const [, bracket, text] of marks.matchAll(/\[([^\][\s]*)\]|\{([^{}]*)\}/g)) {
    if (bracket === undefined) set('text', text)
    else {
      const shape = noteheadShapes[bracket]
      shape ? set('shape', shape) : set('color', bracket)
    }
  }

  return [out, errors]
}

// A bracketed colour is a violin string name (`[G]`), a hex colour (`[#ff8800]`) or
// one of the keywords above (`[red]`). String names are matched first and
// case-sensitively, so `[E]` is the E string while `[e]` is not.
//
// Everything resolves to the uppercase `#RRGGBB` MusicXML demands: the alternative is
// an engraver that drops the attribute and colours nothing, with no error anywhere.
// `#RGB` shorthand is expanded, since it is the spelling people reach for.
export function resolveColor(spec: string): [string | null, string | null] {
  if (spec.length == 0) return [null, 'empty colour']

  // Palette entries go through the same normalisation as a hand-written colour: they
  // are ordinary hex, and a lowercase one would otherwise fail MusicXML's uppercase
  // pattern and be dropped — leaving `[G]` silently colourless while `[#b35009]` works.
  const named = (spec == spec.toUpperCase() ? stringColors[spec] : undefined)
    ?? namedColors[spec.toLowerCase()]
  const hex = named ?? spec

  const short = hex.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i)
  if (short) return [`#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase(), null]

  if (/^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return [hex.toUpperCase(), null]

  return [null, `unusable colour: ${spec}`]
}

// LilyPond denominator to MusicXML duration units; null if it needs a fraction.
export function denomToDuration(denom: number, dots: number): number | null {
  if (!Number.isInteger(denom) || denom < 1) return null

  const base = (DIVISIONS * 4) / denom
  const dotted = base * (2 - Math.pow(2, -dots))

  return Number.isInteger(dotted) && dotted > 0 ? dotted : null
}

// An absolute frequency: no letter, so nothing to engrave and no octave to apply.
// Counts, not booleans: `c8((` opens two slurs, which is how a phrase inside a phrase
// is written. Absent fields rather than zeroes, so an unslurred note stays plain.
// A second `~` says nothing a first did not — and like a repeated mark, only the writer
// knows which they meant, so it is an error rather than a silent last-one-wins.
function tieError(slurs: string, token: string): string | null {
  return (slurs.match(/~/g) || []).length > 1 ? `repeated tie: ${token}` : null
}

function slurred(slurs?: string) {
  const written = slurs || ''
  const starts = written.split('').filter(c => c == '(').length
  const stops = written.split('').filter(c => c == ')').length

  return {
    ...(stops > 0 ? { slurStop: stops } : {}),
    ...(starts > 0 ? { slurStart: starts } : {}),
    // Only meaningful when the note has both kinds; recorded then, so the balance check
    // can tell `c8()` (opens then closes itself) from `c8)(` (ends one, starts another).
    ...(starts > 0 && stops > 0 && written.indexOf('(') < written.indexOf(')')
      ? { slurOpensFirst: true } : {}),
  }
}

function parseHzToken(
  token: string, groups: Record<string, string>, denomPrev: number,
): [SheetNote | null, number, string[]] {
  const { hz, denom, dots, bowing, marks, slurs } = groups
  const tie = (slurs || '').includes('~')

  const denomNum = denom ? parseInt(denom, 10) : denomPrev
  const duration = denomToDuration(denomNum, (dots || '').length)
  if (duration === null) return [null, denomPrev, [`unusable duration in: ${token}`]]

  const freq = parseFloat(hz)
  if (!Number.isFinite(freq) || freq <= 0) return [null, denomPrev, [`unusable frequency in: ${token}`]]

  const bow = bowing ? bowings[bowing] ?? bowings[bowing.toLowerCase()] : undefined

  // An hz note has neither notehead nor staff position, so a colour has nothing to
  // paint, a shape nothing to draw and a fingering nothing to hang off.
  const [{ color, shape, text }, markErrors] = parseMarks(marks || '')
  const unengraveable = [
    color !== undefined && `colour on a frequency: ${token}`,
    shape !== undefined && `shape on a frequency: ${token}`,
    text !== undefined && `text on a frequency: ${token}`,
  ].filter(e => typeof e == 'string')

  return [
    {
      note: null, hz: freq, duration,
      ...(bow ? { bowing: bow } : {}), ...(tie ? { tied: true } : {}),
      ...slurred(slurs),
    },
    denomNum,
    [...markErrors, ...unengraveable, ...[tieError(slurs || '', token)].filter(e => typeof e == 'string')],
  ]
}

function parseToken(token: string, denomPrev: number): [SheetNote | null, number, string[]] {
  const hzMatch = token.match(hzPattern)
  if (hzMatch?.groups) return parseHzToken(token, hzMatch.groups, denomPrev)

  const match = token.match(tokenPattern)
  if (!match?.groups) return [null, denomPrev, [`unparsable token: ${token}`]]

  const { letter, accidentals, octaves, denom, dots, bowing, marks, slurs } = match.groups
  const tie = (slurs || '').includes('~')

  const denomNum = denom ? parseInt(denom, 10) : denomPrev
  const duration = denomToDuration(denomNum, (dots || '').length)
  if (duration === null) return [null, denomPrev, [`unusable duration in: ${token}`]]

  // `Π` has no lowercase, so try the raw character first.
  const bow = bowing ? bowings[bowing] ?? bowings[bowing.toLowerCase()] : undefined
  const bowed = bow ? { bowing: bow } : {}

  const [{ color, shape, text }, markErrors] = parseMarks(marks || '')

  const [resolved, colorError] = color === undefined ? [null, null] : resolveColor(color)
  const colored = resolved ? { color: resolved } : {}

  const shaped = shape ? { shape } : {}

  // Empty parentheses would engrave an empty fingering — a stray mark on the staff.
  const texted = text ? { text } : {}
  const textError = text === '' ? `empty text: ${token}` : null

  const errors = [...markErrors, colorError, textError, tieError(slurs || '', token)].filter(e => typeof e == 'string')

  // A bow mark on a rest has nothing to engrave — say so rather than dropping it.
  if (letter.toLowerCase() == 'r') {
    const restErrors = [
      bow && `bowing on a rest: ${token}`,
      color !== undefined && `colour on a rest: ${token}`,
      shape !== undefined && `shape on a rest: ${token}`,
      text !== undefined && `text on a rest: ${token}`,
      tie && `tie on a rest: ${token}`,
      (slurs || '').match(/[()]/) && `slur on a rest: ${token}`,
    ].filter(e => typeof e == 'string')

    return [{ note: null, duration }, denomNum, [...markErrors, ...restErrors]]
  }

  const accidental = accidentalNames[(accidentals || '').toLowerCase()] ?? (accidentals || '')
  const octave = DEFAULT_OCTAVE
    + (octaves.match(/['’]/g) || []).length
    - (octaves.match(/,/g) || []).length

  const note = ToneLib.parseNote(`${letter.toLowerCase()}${accidental}`)
  if (!note) return [null, denomPrev, [`unparsable note: ${token}`]]

  const tied = tie ? { tied: true } : {}

  return [
    { note: { ...note, octave }, duration, ...bowed, ...colored, ...shaped, ...texted, ...tied, ...slurred(slurs) },
    denomNum,
    errors,
  ]
}

export function parseSheet(source: string): SheetParse {
  const measures: SheetMeasure[] = [[]]
  const errors: string[] = []
  let denomPrev = DEFAULT_DENOM

  for (const token of source.trim().split(/\s+/).filter(t => t.length > 0)) {
    if (token == '|') {
      // A trailing or doubled bar line shouldn't open an empty measure.
      if (measures[measures.length - 1].length > 0) measures.push([])
      continue
    }

    const [note, denomNext, tokenErrors] = parseToken(token, denomPrev)
    denomPrev = denomNext

    // A token can yield a usable note *and* complaints, so keep them independent.
    errors.push(...tokenErrors)
    if (note) measures[measures.length - 1].push(note)
  }

  const kept = measures.filter(m => m.length > 0)

  // A `~` on the final note has nothing to bind to. It is the one tie error that can
  // only be seen after the whole line is parsed, so it is checked here rather than in
  // parseToken — which sees one token and cannot know it is the last.
  const last = kept[kept.length - 1]?.at(-1)
  if (last?.tied) errors.push('tie on the last note, binding to nothing')

  // Slur balance is the same kind of whole-line property: a `)` with nothing open, or a
  // `(` never closed. Counted across bar lines, since a slur may span them.
  // Read in written order: `)` before `(` when both are on a note, since a note that
  // ends one slur and starts another writes them that way. So a closer draws on slurs
  // open BEFORE this note — except in `c8()`, where the note's own opener comes first
  // and the closer takes it back. The `slurs` capture keeps the written order, and
  // `slurred` re-derives the spelling from the counts it recorded.
  let open = 0
  for (const note of kept.flat()) {
    const opened = note.slurStart ?? 0
    const closed = note.slurStop ?? 0

    // `c8()`: opener written first, so it is available to the closer on the same note.
    const available = note.slurOpensFirst ? open + opened : open

    if (closed > available) {
      errors.push('slur closed that was never opened')
      open = 0
      continue
    }

    open += opened - closed
  }
  if (open > 0) errors.push(`slur never closed: ${open} left open`)

  return { measures: kept, errors }
}



// Rotation: splat(rotate(redivide(ms), by), barLengths). Beat is assumed at BEAT, since
// the notation carries no time signature.
const BEAT = DIVISIONS

// Durations one note can spell; 5, 9, 10, 11, 13, 15 are absent and need tied pieces.
const spellable = [16, 14, 12, 8, 7, 6, 4, 3, 2, 1]

// One sixteenth: the note sounding through it, and whether it continues the slot before.
// `tied` points backwards, so a wrap breaks the chain with nothing to fix up.
export type Slot = { note: SheetNote | null, tied: boolean }

// Notation onto the grid; a written `~` becomes one unbroken run.
export function redivide(measures: SheetMeasure[]): Slot[] {
  const slots: Slot[] = []

  for (const note of measures.flat()) {
    const rest = note.note === null && note.hz === undefined
    for (let i = 0; i < note.duration; i++)
      slots.push({ note: rest ? null : note, tied: i > 0 || (!rest && !!slots[slots.length - 1]?.note?.tied) })
  }

  return slots
}

// Shift every slot `by` sixteenths, wrapping. Negative rotates backwards.
export function rotate(slots: Slot[], by: number): Slot[] {
  if (slots.length == 0) return []

  const shift = ((by % slots.length) + slots.length) % slots.length
  return slots.map((_, i) => slots[(i - shift + slots.length) % slots.length])
}

// Grid back into bars, runs re-spelt and tied across beat cuts.
export function splat(slots: Slot[], barLengths: number[]): SheetMeasure[] {
  const measures: SheetMeasure[] = []
  let at = 0

  for (const length of barLengths) {
    const bar: SheetNote[] = []
    const end = Math.min(at + length, slots.length)
    const barStart = at

    while (at < end) {
      const slot = slots[at]

      let run = 1
      while (at + run < end && continues(slot, slots[at + run])) run++

      const heldOn = slot.note !== null && at + run < slots.length && continues(slot, slots[at + run])
      const pieces = cutToBeats(at - barStart, run)

      pieces.forEach((piece, i) => {
        const last = i == pieces.length - 1
        bar.push(slot.note === null
          ? { note: null, duration: piece }
          : { ...slot.note, duration: piece, ...(last && !heldOn ? { tied: undefined } : { tied: true }) })
      })

      at += run
    }

    measures.push(bar.map(n => {
      const out = { ...n }
      if (out.tied === undefined) delete out.tied
      return out
    }))
  }

  return measures
}

// Follows the tie, not object identity: a note split into tied pieces is one sounding.
// Pitch must match too, or a tie would swallow whatever note follows it.
function continues(slot: Slot, next: Slot): boolean {
  if (slot.note === null) return next.note === null
  if (next.note === null || !next.tied) return false

  return samePitch(slot.note, next.note)
}

// Same sounding pitch; `hz` notes compare by frequency, having no letter.
function samePitch(a: SheetNote, b: SheetNote): boolean {
  if (a.hz !== undefined || b.hz !== undefined) return a.hz === b.hz

  return !!a.note && !!b.note
    && a.note.name === b.note.name && a.note.alter === b.note.alter && a.note.octave === b.note.octave
}

// A note crosses a beat only when it starts on one and covers whole beats.
function cutToBeats(start: number, length: number): number[] {
  const pieces: number[] = []
  let at = start
  let left = length

  while (left > 0) {
    let take = at % BEAT == 0 && left >= BEAT
      ? spellable.find(c => c <= left && c % BEAT == 0) ?? BEAT
      : Math.min(left, BEAT - (at % BEAT))

    while (!spellable.includes(take) && take > 0) take--

    pieces.push(take)
    at += take
    left -= take
  }

  return pieces
}

// Bar lines stay; notes move `by` sixteenths and wrap. Slurs are dropped, and a note the
// wrap cuts becomes two — so repeated calls do not compose; rotate once by the total.
export function rotateSheet(measures: SheetMeasure[], by: number): SheetMeasure[] {
  const barLengths = measures.map(m => m.reduce((sum, n) => sum + n.duration, 0))
  const grid = redivide(measures)

  return stripSlurs(splat(rotate(grid, by), barLengths))
}

// Slur spans point at notes that have moved, and half would no longer balance.
function stripSlurs(measures: SheetMeasure[]): SheetMeasure[] {
  return measures.map(m => m.map(n => {
    const out = { ...n }
    delete out.slurStart
    delete out.slurStop
    delete out.slurOpensFirst
    return out
  }))
}
