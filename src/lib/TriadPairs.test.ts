import { describe, expect, test } from 'vitest'
import { majorKey, Note, parseNote, render, semi } from './ToneLib.ts'
import { degreeInKey, degreesInKey, inversions, invert, parseDegree, parseDegrees, triadPairs } from './TriadPairs.ts'

const note = (n: string) => parseNote(n)!
const key = (n: string) => majorKey(note(n))!
const degrees = (n: string, spec: string) => degreesInKey(key(n), note(n), spec)
const show = (ns: Note[]) => ns.map(n => render(n)).join(' ')

describe('TriadPairs', () => {
  test('parse degrees', () => {
    expect(parseDegree('1')).toStrictEqual({ degree: 1, alter: 0 })
    expect(parseDegree('4#')).toStrictEqual({ degree: 4, alter: 1 })
    expect(parseDegree('7b')).toStrictEqual({ degree: 7, alter: -1 })
    expect(parseDegree('9')).toStrictEqual({ degree: 9, alter: 0 })
    expect(parseDegree('0')).toBeNull()
    expect(parseDegree('h')).toBeNull()
    expect(parseDegree('4x')).toBeNull()

    expect(parseDegrees('1 2 5 4#')).toStrictEqual([
      { degree: 1, alter: 0 },
      { degree: 2, alter: 0 },
      { degree: 5, alter: 0 },
      { degree: 4, alter: 1 },
    ])
    expect(parseDegrees('1 2 nope')).toBeNull()
  })

  test('degrees from a key, in the tonic octave', () => {
    expect(show(degrees('c4', '1 2 5 4#'))).toEqual('C4 D4 G4 F#4')
    expect(show(degrees('g3', '1 2 5 4#'))).toEqual('G3 A3 D4 C#4')
    expect(show(degrees('g4', '1 2 5 4#'))).toEqual('G4 A4 D5 C#5')

    expect(show(degrees('c4', '8 9'))).toEqual('C5 D5')
  })

  test('alteration is relative to the key, not the letter', () => {
    expect(show(degrees('f4', '4'))).toEqual('Bb4')
    expect(show(degrees('f4', '4#'))).toEqual('B4')
    expect(show(degrees('c4', '4#'))).toEqual('F#4')

    expect(semi(degreeInKey(key('f4'), note('f4'), { degree: 4, alter: 1 })))
      .toEqual(semi(degreeInKey(key('f4'), note('f4'), { degree: 4, alter: 0 })) + 1)
  })

  test('inversions ascend and keep the pitch classes', () => {
    const triad = degrees('c4', '1 3 5')

    expect(show(invert(triad, 0))).toEqual('C4 E4 G4')
    expect(show(invert(triad, 1))).toEqual('E4 G4 C5')
    expect(show(invert(triad, 2))).toEqual('G4 C5 E5')
    expect(show(invert(triad, 3))).toEqual('C4 E4 G4')

    inversions(triad).forEach(inv => {
      expect(inv.map(n => n.name).sort()).toStrictEqual(['c', 'e', 'g'])
      expect(inv.map(semi)).toStrictEqual([...inv.map(semi)].sort((a, b) => a - b))
    })
  })

  test('triad pairs over three octaves', () => {
    const { groups, notes } = triadPairs('c4', '1 3 5', '2 4# 6', 3)

    expect(groups.length).toEqual(19)
    expect(notes.length).toEqual(57)

    expect(groups.slice(0, 6).map(show)).toStrictEqual([
      'C4 E4 G4',
      'D4 F#4 A4',
      'E4 G4 C5',
      'F#4 A4 D5',
      'G4 C5 E5',
      'A4 D5 F#5',
    ])

    expect(show(groups[6])).toEqual('C5 E5 G5')
    expect(show(groups[12])).toEqual('C6 E6 G6')
    expect(show(groups[17])).toEqual('A6 D7 F#7')
  })

  test('closes on root position, an octave above the start', () => {
    const closing = (root: string, octaves: number) =>
      show(triadPairs(root, '1 3 5', '2 4# 6', octaves).groups.at(-1)!)

    expect(closing('G3', 3)).toEqual('G6 B6 D7')
    expect(closing('G3', 1)).toEqual('G4 B4 D5')
    expect(closing('c4', 3)).toEqual('C7 E7 G7')
    expect(closing('bb3', 3)).toEqual('Bb6 D7 F7')

    const { groups } = triadPairs('G3', '1 3 5', '2 4# 6', 3)
    expect(groups.at(-1)!.map(semi)).toStrictEqual(groups[0].map(s => semi(s) + 36))
  })

  test('G3 over three octaves', () => {
    const { groups, notes } = triadPairs('G3', '1 3 5', '2 4# 6', 3)

    expect(show(degrees('g3', '1 3 5'))).toEqual('G3 B3 D4')
    expect(show(degrees('g3', '2 4# 6'))).toEqual('A3 C#4 E4')

    expect(groups.map(show)).toStrictEqual([
      'G3 B3 D4', 'A3 C#4 E4',
      'B3 D4 G4', 'C#4 E4 A4',
      'D4 G4 B4', 'E4 A4 C#5',

      'G4 B4 D5', 'A4 C#5 E5',
      'B4 D5 G5', 'C#5 E5 A5',
      'D5 G5 B5', 'E5 A5 C#6',

      'G5 B5 D6', 'A5 C#6 E6',
      'B5 D6 G6', 'C#6 E6 A6',
      'D6 G6 B6', 'E6 A6 C#7',

      'G6 B6 D7',
    ])

    expect(show(notes)).toEqual(
      'G3 B3 D4 A3 C#4 E4 B3 D4 G4 C#4 E4 A4 D4 G4 B4 E4 A4 C#5 ' +
      'G4 B4 D5 A4 C#5 E5 B4 D5 G5 C#5 E5 A5 D5 G5 B5 E5 A5 C#6 ' +
      'G5 B5 D6 A5 C#6 E6 B5 D6 G6 C#6 E6 A6 D6 G6 B6 E6 A6 C#7 ' +
      'G6 B6 D7',
    )

    expect(notes.length).toEqual(57)
    expect(render(notes[0])).toEqual('G3')
    expect(render(notes[notes.length - 1])).toEqual('D7')
  })

  test('each octave copy is exactly twelve semitones up', () => {
    const { groups } = triadPairs('bb3', '1 3 5', '2 4# 6', 3)
    const cycles = groups.slice(0, -1)
    const cycle = cycles.length / 3

    cycles.slice(0, cycle).forEach((group, i) => {
      expect(cycles[i + cycle].map(semi)).toStrictEqual(group.map(s => semi(s) + 12))
      expect(cycles[i + 2 * cycle].map(semi)).toStrictEqual(group.map(s => semi(s) + 24))
    })
  })

  test('octaves parameter', () => {
    expect(triadPairs('c4', '1 3 5', '2 4# 6', 1).groups.length).toEqual(7)
    expect(triadPairs('c4', '1 3 5', '2 4# 6', 2).groups.length).toEqual(13)
    expect(triadPairs('c4', '1 3 5', '2 4# 6', 0).groups.length).toEqual(1)
  })

  test('unparseable root', () => {
    expect(triadPairs('h9', '1 3 5', '2 4# 6').groups).toStrictEqual([])
  })
})
