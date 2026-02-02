import { directRange } from './Array'
import { enharmonics, majorKey, Note, parseNote, semi } from './ToneLib'

type String = {
  base: Note,
  positions: Note[],
  positions2: Note[],
}

export const strings: String[] = ([parseNote('G3'), parseNote('D4'), parseNote('A4'), parseNote('E5')] as Note[]).map(string => {
  const frets = directRange(semi(string), semi(string) + 24)
  const notes = frets.flatMap(fret => enharmonics(fret).filter(n => n.alter == 0))

  return {
    base: string,
    positions: notes.slice(0, 8),
    positions2: notes,
  }
})

function stringIndex(string: 'G' | 'D' | 'A' | 'E'): number {
  return 'GDAE'.indexOf(string)
}

export function findTriadOnString(tonic: Note, s: 'G' | 'D' | 'A' | 'E') {
  const key = majorKey(tonic)!
  const triad: Note[] = [key[0]!, key[2]!, key[4]!]
  const string = strings[stringIndex(s)]

  return string.positions2.flatMap(fret => {
    const found = triad.filter(kn => fret.name == kn.name)

    return found.slice(0, 1).flatMap(keyNote => {
      const fretInKey = {...fret, alter: keyNote.alter}
      return semi(string.base) + 1 <= semi(fretInKey) ? [fretInKey] : []
    })
  }).slice(0, 4)
}
