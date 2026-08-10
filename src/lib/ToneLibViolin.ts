import { directRange, transpose, zipWithIndex } from './Array'
import { maybeReverse, pick, randInt } from './Random'
import { enharmonics, Key, majorKey, Note, parseNote, rename, render, renderN, semi } from './ToneLib'
import _ from 'lodash'

// TODO: content: scales: remove half-positions in ToneLibViolin (maybe, we'll see)

type String = {
  base: Note,
  positions: Note[], // C major, open string + all positions up until second octave
}

const bases = ([parseNote('G3'), parseNote('D4'), parseNote('A4'), parseNote('E5')] as Note[])

export function stringsSpanning(span: number = 24): String[] {
  return bases.map(string => {
    const frets = directRange(semi(string), semi(string) + span)
    const notes = frets.flatMap(fret => enharmonics(fret).filter(n => n.alter == 0))

    return {
      base: string,
      positions: notes,
    }
  })
}

export const strings: String[] = stringsSpanning()

export const strings3: String[] = stringsSpanning(36)

function stringIndex(string: 'G' | 'D' | 'A' | 'E'): number {
  return 'GDAE'.indexOf(string)
}

function dropPositionsTranpose(positions: Note[][][]): Note[][] {
  const firstUndroppedIndex = zipWithIndex(transpose(positions)).find(([_, position]) =>
    position.every(p => p.length != 0)
  )![0]

  return positions.map(ps => ps.slice(firstUndroppedIndex).map(p => p[0]))
}

// do this only on strings produced by strings/stringsForTonality
export function stringsAboveOpen(k: Key): String[] {
  const strings = stringsForTonality(k)
  const aligned = dropPositionsTranpose(strings.map(s => s.positions.map(n => [n].filter(n => semi(n) > semi(s.base)))))

  return aligned.map((p, idx) => {
    return { ...strings[idx], positions: p } satisfies String
  })
}

// because notes move and a position is defined by fifths,
// in Gb the empty string position is no longer there
// in F# the empty string position is lifted to half-position
export function stringsForTonality(k: Key): String[] {
  const stringPositions = dropPositionsTranpose(strings.map(s => {
    return s.positions.map(n => [rename(n, k)].filter(n => semi(n) >= semi(s.base)))
  }))

  return stringPositions.map((ps, idx) => {
    return { base: strings[idx].base, positions: ps } satisfies String
  })
}

// @out guarantees four notes in output
export function findTriadOnString(tonic: Note, s: 'G' | 'D' | 'A' | 'E'): Note[] {
  const key = majorKey(tonic)!
  const triad: Note[] = [key[0]!, key[2]!, key[4]!]
  const string = strings[stringIndex(s)]

  return string.positions.flatMap(fret => {
    const found = triad.filter(kn => fret.name == kn.name)

    return found.slice(0, 1).flatMap(keyNote => {
      const fretInKey = { ...fret, alter: keyNote.alter }
      return semi(string.base) + 1 <= semi(fretInKey) ? [fretInKey] : []
    })
  }).slice(0, 4)
}

export function chromaticSlide(tonic: Note | string, s: 'G' | 'D' | 'A' | 'E'): string {
  const note = typeof tonic === 'string' ? parseNote(tonic)! : tonic
  const triad = findTriadOnString(note, s)

  const [first, next] = maybeReverse(triad.slice(randInt(0, 2)).slice(0, 2))

  const ordered = semi(first) < semi(next)
  const arrow = ordered ? '↑' : '↓'

  const string = strings[stringIndex(s)]
  const lowest = ordered ? first : next
  const distance = semi(lowest) - semi(string.base)
  const fingers =
    distance >= 6
      ? '1234'
      : distance >= 4
        ? '123'
        : distance >= 2
          ? '12'
          : '1'

  return `${s}(${pick(fingers.split(''))}):${render(first)}${arrow}${render(next)}`
}

export function positionsQuiz(): string[] {
  return strings.flatMap(string => {
    const base = renderN(string.base)
    return string.positions.slice(1).map((fret, index) =>
      `${base}${index + 1} = ${renderN(fret)}`
    )
  })
}

export type StringName = 'G' | 'D' | 'A' | 'E'

export type FingerPosition = {
  string: StringName,
  position: number,
  finger: number,
  note: Note,
}

export type ModeShift = {
  mode: number,
  root: Note,
  start: FingerPosition,
  end: FingerPosition,
  shifts: number,
}

function columnOfLetter(positions: Note[], n: Note): number {
  return positions.findIndex(p => p.name == n.name && p.octave == n.octave)
}

function positionOf(column: number, finger: number): number {
  return finger == 0 ? column + 1 : column - (finger - 1)
}

export function fingerAboveOpen(note: Note, base: Note): number {
  const distance = semi(note) - semi(base)
  return distance == 0 ? 0 : distance <= 2 ? 1 : 2
}

export function fingerPosition(string: StringName, note: Note, finger?: number): FingerPosition | null {
  const s = strings3[stringIndex(string)]
  const column = columnOfLetter(s.positions, note)
  if (column < 0) return null

  const f = finger ?? fingerAboveOpen(note, s.base)

  return { string, position: positionOf(column, f), finger: f, note }
}

export function shifts(start: FingerPosition, end: FingerPosition): number {
  return end.position - start.position
}

export function modeShifts(
  root: Note | string,
  octaves: number = 3,
  endFinger: number = 4,
  startString: StringName = 'G',
  endString: StringName = 'E',
): ModeShift[] {
  const note = typeof root === 'string' ? parseNote(root) : root
  if (!note) return []

  const key = majorKey(note)
  if (!key) return []

  const g = strings3[stringIndex(startString)]

  return key.flatMap((keyNote, mode) => {
    const column = g.positions.findIndex(p => p.name == keyNote.name)
    const tonic: Note = { ...keyNote, octave: g.positions[column].octave }

    const start = fingerPosition(startString, tonic)
    const end = fingerPosition(endString, { ...tonic, octave: tonic.octave + octaves }, endFinger)
    if (!start || !end) return []

    return [{ mode, root: note, start, end, shifts: shifts(start, end) } satisfies ModeShift]
  })
}

export function frets(): string[][] {
  return strings.map((string, stringIdx) => {
    const base = semi(string.base)

    return directRange(base + 1, base + 24).map(semi => {
      const names = _.sortBy(enharmonics(semi), semi => Math.abs(semi.alter)).slice(0, 2).map(n => render(n, true))
      return `${names.join('/')}-${'IV III II I'.split(' ')[stringIdx]}`
    })
  })
}
