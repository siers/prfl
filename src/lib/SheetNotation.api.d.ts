// The public API of SheetNotation.ts. Kept honest by SheetNotation.api.test.ts.
import * as ToneLib from './ToneLib'

// `<letter><accidentals><octaves><duration><dots><bowing><marks><slurs/tie>`:
// `c4 d4 e8 f8 | g2 a'4`, `bes,8.v[G]{3}~`, `c8( d e f)`, `<442hz>4`, `r16`.
export declare const DIVISIONS: 4

export type Bowing = 'up' | 'down'

export type NoteheadShape = 'x'

export type SheetNote = {
  note: ToneLib.Note | null
  hz?: number
  duration: number
  bowing?: Bowing
  color?: string
  shape?: NoteheadShape
  text?: string
  tied?: boolean
  slurStart?: number
  slurStop?: number
  slurOpensFirst?: boolean
}

export type SheetMeasure = SheetNote[]

export type SheetParse = {
  measures: SheetMeasure[]
  errors: string[]
}

export type Marks = { color?: string, shape?: NoteheadShape, text?: string }

export declare const stringColors: Record<string, string>

// A bad token is dropped and reported; the rest of the line survives.
export declare function parseSheet(source: string): SheetParse

// Null when the length needs a fraction of a DIVISIONS unit.
export declare function denomToDuration(denom: number, dots: number): number | null

export declare function parseMarks(marks: string): [Marks, string[]]

// To uppercase `#RRGGBB`, the only form MusicXML keeps.
export declare function resolveColor(spec: string): [string | null, string | null]

// One sixteenth of time; `tied` points backwards, so a wrap breaks the chain.
export type Slot = { note: SheetNote | null, tied: boolean }

export declare function redivide(measures: SheetMeasure[]): Slot[]

// Exact: rotate(rotate(g, a), b) === rotate(g, a + b).
export declare function rotate(slots: Slot[], by: number): Slot[]

// Beat assumed at DIVISIONS, the notation carrying no time signature.
export declare function splat(slots: Slot[], barLengths: number[]): SheetMeasure[]

// Bar lengths and timing hold, but N calls add up to N attacks, one per wrap — to
// compose, rotate the grid once by the total. Slurs are dropped.
export declare function rotateSheet(measures: SheetMeasure[], by: number): SheetMeasure[]
