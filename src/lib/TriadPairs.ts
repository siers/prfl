import { directRange, times, zipT } from './Array'
import { addAccidental, addInterval, altersMap, Key, majorKey, Note, parseNote, rename } from './ToneLib'

export interface Degree {
  degree: number,
  alter: number,
}

export function parseDegree(spec: string): Degree | null {
  const match = spec.match(/^(?<degree>[1-9][0-9]*)(?<accds>[b#]{0,2})?$/)
  if (!match?.groups) return null

  return {
    degree: parseInt(match.groups.degree, 10),
    alter: altersMap[match.groups.accds || ''],
  }
}

export function parseDegrees(spec: string): Degree[] | null {
  const degrees = spec.trim().split(/\s+/).filter(t => t.length > 0).map(parseDegree)
  return degrees.every(d => d !== null) ? degrees : null
}

export function degreeInKey(key: Key, tonic: Note, d: Degree): Note {
  const scale = addInterval({ ...tonic, alter: key[0].alter }, d.degree - 1)
  return addAccidental(rename(scale, key), d.alter)
}

export function degreesInKey(key: Key, tonic: Note, spec: string): Note[] {
  return (parseDegrees(spec) ?? []).map(d => degreeInKey(key, tonic, d))
}

export function invert(chord: Note[], by: number): Note[] {
  const n = chord.length
  if (n === 0) return []
  const shift = ((by % n) + n) % n

  return times(n).map((_, i) => {
    const note = chord[(i + shift) % n]
    return { ...note, octave: note.octave + (i + shift >= n ? 1 : 0) }
  })
}

export function inversions(chord: Note[]): Note[][] {
  return chord.map((_, i) => invert(chord, i))
}

export function transposeOctaves(notes: Note[], octaves: number): Note[] {
  return notes.map(n => ({ ...n, octave: n.octave + octaves }))
}

export function triadPairs(
  root: Note | string,
  specA: string,
  specB: string,
  octaves: number = 3,
): { groups: Note[][], notes: Note[] } {
  const tonic = typeof root === 'string' ? parseNote(root) : root
  if (!tonic) return { groups: [], notes: [] }

  const key = majorKey(tonic)
  if (!key) return { groups: [], notes: [] }

  const a = degreesInKey(key, tonic, specA)
  const cycle = zipT(inversions(a), inversions(degreesInKey(key, tonic, specB))).flat()

  const groups = [
    ...directRange(0, octaves - 1).flatMap(octave =>
      cycle.map(group => transposeOctaves(group, octave)),
    ),
    transposeOctaves(a, octaves),
  ]

  return { groups, notes: groups.flat() }
}
