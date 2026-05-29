import { describe, expect, test } from 'vitest'
import { findTriadOnString, positionsQuiz, strings, stringsForTonality } from './ToneLibViolin.ts'
import { findMajor, Key, parseNote, render } from './ToneLib.ts'
import { shuffleArray } from './Random.tsx'
import { transpose } from './Array.ts'

describe('ToneLibViolin', () => {
  test('basic', () => {
    strings.forEach(string => string.positions2.forEach(p => expect(p.alter).toEqual(0)))
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
    const firstPositionFor = (key: Key) =>
      transpose(stringsForTonality(key).map(s => s.positions))[0]

    const firstPositionRenderFor = (note: string) =>
      firstPositionFor(findMajor(parseNote(note)!)!).map(n => render(n)).join(' ')

    expect(firstPositionRenderFor('D')).toStrictEqual('G3 D4 A4 E5')
    expect(firstPositionRenderFor('B')).toStrictEqual('G#3 D#4 A#4 E5')
    expect(firstPositionRenderFor('Gb')).toStrictEqual('Ab3 Eb4 Bb4 F5')
    expect(firstPositionRenderFor('F#')).toStrictEqual('G#3 D#4 A#4 E#5')
  })
})
