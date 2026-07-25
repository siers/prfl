import { describe, expect, test } from 'vitest'
import { findTriadOnString, frets, positionsQuiz, strings, stringsAboveOpen, stringsForTonality } from './ToneLibViolin.ts'
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

  test('frets', () => {
    expect(frets()).toStrictEqual(
      [
        [
          "G#3/Ab3-IV",
          "A3-IV",
          "A#3/Bb3-IV",
          "B3/Cb3-IV",
          "C4/B#4-IV",
          "C#4/Db4-IV",
          "D4-IV",
          "D#4/Eb4-IV",
          "E4/Fb4-IV",
          "F4/E#4-IV",
          "F#4/Gb4-IV",
          "G4-IV",
          "G#4/Ab4-IV",
          "A4-IV",
          "A#4/Bb4-IV",
          "B4/Cb4-IV",
          "C5/B#5-IV",
          "C#5/Db5-IV",
          "D5-IV",
          "D#5/Eb5-IV",
          "E5/Fb5-IV",
          "F5/E#5-IV",
          "F#5/Gb5-IV",
          "G5-IV",
        ],
        [
          "D#4/Eb4-III",
          "E4/Fb4-III",
          "F4/E#4-III",
          "F#4/Gb4-III",
          "G4-III",
          "G#4/Ab4-III",
          "A4-III",
          "A#4/Bb4-III",
          "B4/Cb4-III",
          "C5/B#5-III",
          "C#5/Db5-III",
          "D5-III",
          "D#5/Eb5-III",
          "E5/Fb5-III",
          "F5/E#5-III",
          "F#5/Gb5-III",
          "G5-III",
          "G#5/Ab5-III",
          "A5-III",
          "A#5/Bb5-III",
          "B5/Cb5-III",
          "C6/B#6-III",
          "C#6/Db6-III",
          "D6-III",
        ],
        [
          "A#4/Bb4-II",
          "B4/Cb4-II",
          "C5/B#5-II",
          "C#5/Db5-II",
          "D5-II",
          "D#5/Eb5-II",
          "E5/Fb5-II",
          "F5/E#5-II",
          "F#5/Gb5-II",
          "G5-II",
          "G#5/Ab5-II",
          "A5-II",
          "A#5/Bb5-II",
          "B5/Cb5-II",
          "C6/B#6-II",
          "C#6/Db6-II",
          "D6-II",
          "D#6/Eb6-II",
          "E6/Fb6-II",
          "F6/E#6-II",
          "F#6/Gb6-II",
          "G6-II",
          "G#6/Ab6-II",
          "A6-II",
        ],
        [
          "F5/E#5-I",
          "F#5/Gb5-I",
          "G5-I",
          "G#5/Ab5-I",
          "A5-I",
          "A#5/Bb5-I",
          "B5/Cb5-I",
          "C6/B#6-I",
          "C#6/Db6-I",
          "D6-I",
          "D#6/Eb6-I",
          "E6/Fb6-I",
          "F6/E#6-I",
          "F#6/Gb6-I",
          "G6-I",
          "G#6/Ab6-I",
          "A6-I",
          "A#6/Bb6-I",
          "B6/Cb6-I",
          "C7/B#7-I",
          "C#7/Db7-I",
          "D7-I",
          "D#7/Eb7-I",
          "E7/Fb7-I",
        ],
      ]
    )
  })
})
