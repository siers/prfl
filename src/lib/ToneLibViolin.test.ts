import { describe, expect, test } from 'vitest'
import { findTriadOnString, positionsQuiz, strings, stringsAboveOpen, stringsForTonality } from './ToneLibViolin.ts'
import { findMajor, Key, parseNote, render } from './ToneLib.ts'
import { shuffleArray } from './Random.tsx'
import { transpose } from './Array.ts'

describe('ToneLibViolin', () => {
  test('basic', () => {
    strings.forEach(string => string.positions.forEach(p => expect(p.alter).toEqual(0)))
  })

  test('find triad', () => {
    expect(findTriadOnString(parseNote('G')!, 'G').map(n => render(n)).join(' ')).toEqual('B3 D4 G4 B4')
    expect(findTriadOnString(parseNote('E')!, 'G').map(n => render(n)).join(' ')).toEqual('G#3 B3 E4 G#4')
    expect(findTriadOnString(parseNote('Eb')!, 'G').map(n => render(n)).join(' ')).toEqual('Bb3 Eb4 G4 Bb4')
    expect(findTriadOnString(parseNote('Bb')!, 'G').map(n => render(n)).join(' ')).toEqual('Bb3 D4 F4 Bb4')

    expect(findTriadOnString(parseNote('A')!, 'E').map(n => render(n)).join(' ')).toEqual('A5 C#6 E6 A6')
  })

  test('positions quiz', () => {
    const quizes = shuffleArray(positionsQuiz());

    ['G4 = D', 'D5 = B', 'A4 = E', 'D4 = A', 'G5 = E'].forEach(mustExist =>
      expect(quizes.indexOf(mustExist) !== -1).toBe(true)
    )
  })

  test('stringsForTonality', () => {
    const positionFor = (key: Key, n: number) =>
      transpose(stringsForTonality(key).map(s => s.positions))[n]

    const positionRenderFor = (note: string, n: number) =>
      positionFor(findMajor(parseNote(note)!)!, n).map(n => render(n)).join(' ')

    expect(positionRenderFor('D', 0)).toStrictEqual('G3 D4 A4 E5')
    expect(positionRenderFor('B', 0)).toStrictEqual('G#3 D#4 A#4 E5')
    expect(positionRenderFor('Gb', 0)).toStrictEqual('Ab3 Eb4 Bb4 F5')
    expect(positionRenderFor('F#', 0)).toStrictEqual('G#3 D#4 A#4 E#5')

    expect(positionRenderFor('E', 0)).toStrictEqual('G#3 D#4 A4 E5')
    expect(positionRenderFor('E', 1)).toStrictEqual('A3 E4 B4 F#5')
  })

  test('stringAboveOpen', () => {
    const strings = stringsAboveOpen(findMajor(parseNote('D')!)!)
    const sao = transpose(strings.map(s => s.positions))[0].map(n => render(n)).join(' ')

    expect(sao).toBe('A3 E4 B4 F#5')
  })
})
