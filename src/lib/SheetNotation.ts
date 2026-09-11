// A bare-bones serialized sheet-music syntax for `.rndl` lines, LilyPond-flavoured.
//
//   [`c4 d4 e8 f8 | g2 a'4 bes,4`]sheet:hide
//
// A token is `<letter><accidentals><octave marks><duration><dots><bowing><colour>`:
//
//   letter      a-g (case-insensitive)
//   accidentals `is`/`es` (LilyPond) or `#`/`b`, up to two — c#, cis, bes, ceses
//   octave      `'` up an octave, `,` down an octave, relative to octave 4
//   duration    LilyPond denominator: 1 = whole, 2 = half, 4 = quarter, 8, 16
//   dots        `.` multiplies the duration by 1.5 (a second dot by 1.75)
//   bowing      trailing `v` up-bow, `n` down-bow (or the glyphs `V` / `Π`)
//   colour      `[G]` `[D]` `[A]` `[E]` for the violin string of that name, a hex
//               colour `[#ff8800]`, or a keyword `[red]`. Colours the notehead only.
//   rest        `r` in place of the letter (duration/dots still apply)
//
// Brackets are used because every letter is already spoken for: a-g are notes, `r`
// is a rest, `v`/`n` are bowings, `b` is a flat. Unlike duration, colour does not
// carry over to the next token — it is a mark on one note, not a running state.
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

export type SheetNote = {
  note: ToneLib.Note | null // null = rest, or a pitch only `hz` can express
  hz?: number               // exact frequency, for synthesis; unengraveable
  duration: number          // in divisions
  bowing?: Bowing
  color?: string            // CSS colour for the notehead, already resolved from the palette
}

export type SheetMeasure = SheetNote[]

export type SheetParse = {
  measures: SheetMeasure[]
  errors: string[]
}

const DEFAULT_OCTAVE = 4
const DEFAULT_DENOM = 4

export const stringColors: Record<string, string> = {
  G: '#b35009',
  D: '#0cb7c9',
  A: '#c9c60c',
  E: '#09e698',
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

// `<NNNhz>` with the same trailing duration/dots/bowing; `'`/`,` tolerated and dropped.
// A colour is matched so it can be reported, not silently treated as an unparsable token.
const hzPattern = /^<(?<hz>\d+(?:\.\d+)?)hz>(?<octaves>['’,]*)(?<denom>\d+)?(?<dots>\.*)(?<bowing>[vn∨Π])?(?:\[(?<color>[^\][\s]*)\])?$/i

// `<letter><accidentals><octaves><duration><dots><bowing><colour>` — every part but the letter optional.
const tokenPattern = /^(?<letter>[a-gr])(?<accidentals>isis|is|eses|es|[#b]{1,2})?(?<octaves>['’,]*)(?<denom>\d+)?(?<dots>\.*)(?<bowing>[vn∨Π])?(?:\[(?<color>[^\][\s]*)\])?$/i

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
function parseHzToken(
  token: string, groups: Record<string, string>, denomPrev: number,
): [SheetNote | null, number, string | null] {
  const { hz, denom, dots, bowing, color } = groups

  const denomNum = denom ? parseInt(denom, 10) : denomPrev
  const duration = denomToDuration(denomNum, (dots || '').length)
  if (duration === null) return [null, denomPrev, `unusable duration in: ${token}`]

  const freq = parseFloat(hz)
  if (!Number.isFinite(freq) || freq <= 0) return [null, denomPrev, `unusable frequency in: ${token}`]

  const bow = bowing ? bowings[bowing] ?? bowings[bowing.toLowerCase()] : undefined

  // An hz note has no notehead, so a colour on it has nothing to paint.
  const colored = color === undefined ? null : `colour on a frequency: ${token}`

  return [{ note: null, hz: freq, duration, ...(bow ? { bowing: bow } : {}) }, denomNum, colored]
}

function parseToken(token: string, denomPrev: number): [SheetNote | null, number, string | null] {
  const hzMatch = token.match(hzPattern)
  if (hzMatch?.groups) return parseHzToken(token, hzMatch.groups, denomPrev)

  const match = token.match(tokenPattern)
  if (!match?.groups) return [null, denomPrev, `unparsable token: ${token}`]

  const { letter, accidentals, octaves, denom, dots, bowing, color } = match.groups

  const denomNum = denom ? parseInt(denom, 10) : denomPrev
  const duration = denomToDuration(denomNum, (dots || '').length)
  if (duration === null) return [null, denomPrev, `unusable duration in: ${token}`]

  // `Π` has no lowercase, so try the raw character first.
  const bow = bowing ? bowings[bowing] ?? bowings[bowing.toLowerCase()] : undefined
  const bowed = bow ? { bowing: bow } : {}

  const [resolved, colorError] = color === undefined ? [null, null] : resolveColor(color)
  const colored = resolved ? { color: resolved } : {}

  // A bow mark on a rest has nothing to engrave — say so rather than dropping it.
  if (letter.toLowerCase() == 'r') {
    const restError = bow ? `bowing on a rest: ${token}`
      : color !== undefined ? `colour on a rest: ${token}` : null
    return [{ note: null, duration }, denomNum, restError]
  }

  const accidental = accidentalNames[(accidentals || '').toLowerCase()] ?? (accidentals || '')
  const octave = DEFAULT_OCTAVE
    + (octaves.match(/['’]/g) || []).length
    - (octaves.match(/,/g) || []).length

  const note = ToneLib.parseNote(`${letter.toLowerCase()}${accidental}`)
  if (!note) return [null, denomPrev, `unparsable note: ${token}`]

  return [{ note: { ...note, octave }, duration, ...bowed, ...colored }, denomNum, colorError]
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

    const [note, denomNext, error] = parseToken(token, denomPrev)
    denomPrev = denomNext

    // A token can yield a usable note *and* a complaint, so keep them independent.
    if (error) errors.push(error)
    if (note) measures[measures.length - 1].push(note)
  }

  return { measures: measures.filter(m => m.length > 0), errors }
}
