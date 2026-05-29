import { directRange, transpose, zipWithIndex } from './Array'
import { maybeReverse, pick, randInt } from './Random'
import { enharmonics, Key, majorKey, Note, parseNote, rename, render, semi } from './ToneLib'

type String = {
  base: Note,
  positions: Note[], // C major, open string + all positions up until second octave
}

export const strings: String[] = ([parseNote('G3'), parseNote('D4'), parseNote('A4'), parseNote('E5')] as Note[]).map(string => {
  const frets = directRange(semi(string), semi(string) + 24)
  const notes = frets.flatMap(fret => enharmonics(fret).filter(n => n.alter == 0))

  return {
    base: string,
    positions: notes,
  }
})

function stringIndex(string: 'G' | 'D' | 'A' | 'E'): number {
  return 'GDAE'.indexOf(string)
}

// do this only on strings produced by strings/stringsForTonality
export function stringAboveOpen(s: String): String {
  return { ...s, positions: s.positions.filter(n => semi(n) > semi(s.base)) }
}

// because notes move and a position is defined by fifths,
// in Gb the empty string position is no longer there
// in F# the empty string position is lifted to half-position
export function stringsForTonality(k: Key): String[] {
  const stringPositions = strings.map(s => {
    return s.positions.map(n => [rename(n, k)].filter(n => semi(n) >= semi(s.base)))
  })

  const dropPositions =
    zipWithIndex(transpose(stringPositions)).find(([_, position]) =>
      position.every(p => p.length != 0)
    )![0]

  return stringPositions.map((ps, idx) => {
    const psD = ps.slice(dropPositions).map(maybe => maybe[0])
    return { base: strings[idx].base, positions: psD } satisfies String
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
    const base = render(string.base, false)
    return string.positions.slice(1).map((fret, index) =>
      `${base}${index + 1} = ${render(fret, false)}`
    )
  })
}
