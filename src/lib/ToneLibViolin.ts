import { directRange, transpose, zipLongest, zipWithIndex } from './Array'
import { maybeReverse, pick, randInt, shuffleArray } from './Random'
import { enharmonics, equalLetterOctave, findMajor, Key, majorKey, Note, parseNote, rebaseSemiByPitch, rename, render, renderN, semi } from './ToneLib'
import _ from 'lodash'

// TODO: content: scales: remove half-positions in ToneLibViolin (maybe, we'll see)

export type StringName = 'G' | 'D' | 'A' | 'E'
export const stringNames: StringName[] = ['G', 'D', 'A', 'E']

type String = {
  name: StringName,
  base: Note,
  positions: Note[], // C major, open string + all positions up until second octave
}

export function stringsSpanning(span: number = 24): String[] {
  const bases: [StringName, Note][] = [
    ['G', parseNote('G3')!],
    ['D', parseNote('D4')!],
    ['A', parseNote('A4')!],
    ['E', parseNote('E5')!],
  ]

  return bases.map(([name, base]) => {
    const frets = directRange(semi(base), semi(base) + span)
    const notes = frets.flatMap(fret => enharmonics(fret).filter(n => n.alter == 0))

    return {
      name,
      base,
      positions: notes,
    }
  })
}

export const strings: String[] = stringsSpanning()

export const strings3: String[] = stringsSpanning(36)

export type FingerPosition = {
  string: StringName,
  position: number,
  finger: number,
  note: Note,
}

function stringIndex(string: StringName): number {
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
    return { name: strings[idx].name, base: strings[idx].base, positions: ps } satisfies String
  })
}

// @out guarantees four notes in output
export function findTriadOnString(tonic: Note, s: StringName): Note[] {
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

type StringEmbeddedNote = {
  string: String,
  position: number,
  chromPosition: number,
  note: Note,
}

export function renderSen(sen: StringEmbeddedNote): string {
  return `${sen.string.name}${sen.position}`
}

// bug: G# isn't empty string, but wouldn't be returned,
// so instead of slice(n) it should be (if index <= startingFrom || semi(string) < semi(note) return [])
export function embedNote(note: Note, restrict: StringName[] = stringNames, startingFrom = 0): StringEmbeddedNote[] {
  return restrict.flatMap(stringName => {
    const string = strings3[stringIndex(stringName)]
    return string.positions.flatMap((position, idx) => {
      const sen = {
        string,
        position: idx,
        note,
        chromPosition: semi(note) - semi(string.base),
      }

      return equalLetterOctave(note, position) && sen.chromPosition >= startingFrom ? [sen] : []
    })
  })
}

// serializable variant, with less info: no root, and only the shift count shown for the scale.
export type ModeShift = {
  modeNr: number,
  mode: string,
  scale: string,
  start: number,
  end: number,
  shifts: number,
}

// fully computed variant: carries the root and both shift types.
export type ModeShiftGen = ModeShift & {
  root: Note,
  diatonicShifts: number,
  chromShifts: number,
}

const modes = 'ion dor phr lyd mix aeo loc'.split(' ')

// TODO: bug: chromatic is off by variable number (1-4) of shifts for computed starting fingers 0/1
// TODO: randomize start/end fingers
// TODO: handle -1/+1/+6, because it will have minor fingering differences
export function modeShiftsGen(
  keyIn: Note | Key,
  scales?: string,
  startFinger: number = 2,
  endFinger: number = 4
): ModeShiftGen[] {
  const key = Array.isArray(keyIn) ? keyIn : findMajor(keyIn)!

  const ksc = zipLongest<Note | string>(key, shuffleArray((scales || 'maj').split(' ')))

  return ksc.map(([knoteIn, scaleIn], idx) => {
    const [knote, scale] = [knoteIn, scaleIn] as [Note, string]
    const modeIdx = idx % modes.length

    const note = rebaseSemiByPitch(knote, parseNote('G3')!)
    const endNote = { ...note, octave: note.octave + 3 }

    const beginPos: StringEmbeddedNote = embedNote(note, ['G'])[0]
    const endPos: StringEmbeddedNote = embedNote(endNote, ['E'])[0]

    const startCompensation = Math.max(0, startFinger - beginPos.position)
    const endCompensation = endFinger - startFinger
    const diatonicShifts = endPos.position - beginPos.position - startCompensation - endCompensation

    const chromStringCompensation = -startCompensation - 1 + 2 * 3 // off-by-one(?) + start finger + string crossings
    const chromShifts = endPos.chromPosition - beginPos.chromPosition + chromStringCompensation + endCompensation

    const computedStartingFinger = startFinger - startCompensation

    return {
      modeNr: modeIdx,
      mode: modes[modeIdx],
      scale,
      root: note,
      start: computedStartingFinger,
      end: endFinger,
      diatonicShifts,
      chromShifts,
      shifts: scale == 'chrom' || scale == 'chr' ? chromShifts : diatonicShifts,
    }
  })
}

export function modeShifts(
  keyIn: Note | Key,
  scales: string = 'maj',
  startFinger: number = 2,
  endFinger: number = 4
): string[] {
  return modeShiftsGen(keyIn, scales, startFinger, endFinger).map(serializeModeShift)
}

// modeNr is recovered from the mode; root and the raw shift counts are not encoded.
export function serializeModeShift(ms: ModeShift): string {
  return `${ms.mode}.${ms.scale}:${ms.start}${ms.end};s${ms.shifts}`
}

export function deserializeModeShift(s: string): ModeShift {
  const match = s.match(/^(?<mode>[^.:]+)\.(?<scale>[^:]+):(?<start>\d)(?<end>\d);s(?<shifts>-?\d+)$/)
  if (!match) throw new Error(`invalid ModeShift: ${s}`)
  const { mode, scale, start, end, shifts } = match.groups!
  return {
    modeNr: modes.indexOf(mode),
    mode,
    scale,
    start: Number(start),
    end: Number(end),
    shifts: Number(shifts),
  }
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
