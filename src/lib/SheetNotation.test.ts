import { describe, expect, test } from 'vitest'
import { denomToDuration, parseSheet } from './SheetNotation'

describe('denomToDuration', () => {
  test('lilypond denominators', () => {
    expect(denomToDuration(1, 0)).toBe(16) // whole
    expect(denomToDuration(2, 0)).toBe(8)  // half
    expect(denomToDuration(4, 0)).toBe(4)  // quarter
    expect(denomToDuration(16, 0)).toBe(1) // sixteenth
  })

  test('dots', () => {
    expect(denomToDuration(4, 1)).toBe(6)  // dotted quarter
    expect(denomToDuration(2, 2)).toBe(14) // double-dotted half
  })

  test('rejects what does not fit the division grid', () => {
    expect(denomToDuration(32, 0)).toBeNull()
    expect(denomToDuration(16, 1)).toBeNull()
    expect(denomToDuration(0, 0)).toBeNull()
  })
})

describe('parseSheet', () => {
  test('pitch, duration and bar lines', () => {
    const { measures, errors } = parseSheet('c4 d4 e8 f8 | g2 a2')

    expect(errors).toStrictEqual([])
    expect(measures.map(m => m.map(n => [n.note && n.note.name, n.duration]))).toStrictEqual([
      [['c', 4], ['d', 4], ['e', 2], ['f', 2]],
      [['g', 8], ['a', 8]],
    ])
  })

  test('duration carries over, as in lilypond', () => {
    const { measures } = parseSheet('c8 d e f')
    expect(measures[0].map(n => n.duration)).toStrictEqual([2, 2, 2, 2])
  })

  test('accidentals, both spellings', () => {
    const { measures } = parseSheet('cis4 c#4 bes4 bb4 ceses4')
    expect(measures[0].map(n => n.note!.alter)).toStrictEqual([1, 1, -1, -1, -2])
  })

  test('octave marks', () => {
    const { measures } = parseSheet("c4 c'4 c''4 c,4")
    expect(measures[0].map(n => n.note!.octave)).toStrictEqual([4, 5, 6, 3])
  })

  test('octave marks with accidentals', () => {
    const { measures } = parseSheet("cis'4")
    expect(measures[0].map(n => [n.note!.octave, n.note!.alter])).toStrictEqual([[5, 1]])
  })

  test('rests', () => {
    const { measures } = parseSheet('c4 r4 r2')
    expect(measures[0].map(n => [n.note, n.duration])).toStrictEqual([
      [{ name: 'c', alter: 0, octave: 4 }, 4], [null, 4], [null, 8],
    ])
  })

  test('bowings', () => {
    const { measures, errors } = parseSheet("c4v d4n e4V f4Π g4 a'8.v")

    expect(errors).toStrictEqual([])
    expect(measures[0].map(n => n.bowing)).toStrictEqual([
      'up', 'down', 'up', 'down', undefined, 'up',
    ])
  })

  test('a bow mark on a rest is reported, the rest still lands', () => {
    const { measures, errors } = parseSheet('c4 r4n')

    expect(measures[0].map(n => [n.note?.name ?? null, n.bowing])).toStrictEqual([
      ['c', undefined], [null, undefined],
    ])
    expect(errors).toStrictEqual(['bowing on a rest: r4n'])
  })

  test('bowing does not swallow a note letter', () => {
    // `n` and `v` aren't note letters, so unmarked tokens stay unmarked.
    const { measures } = parseSheet('c8v d e')
    expect(measures[0].map(n => [n.note!.name, n.duration, n.bowing])).toStrictEqual([
      ['c', 2, 'up'], ['d', 2, undefined], ['e', 2, undefined],
    ])
  })

  test('bad tokens are collected, good ones survive', () => {
    const { measures, errors } = parseSheet('c4 h4 d4')
    expect(measures[0].map(n => n.note!.name)).toStrictEqual(['c', 'd'])
    expect(errors).toStrictEqual(['unparsable token: h4'])
  })

  test('no empty measures from stray bar lines', () => {
    expect(parseSheet('| c4 | | d4 |').measures.length).toBe(2)
    expect(parseSheet('').measures).toStrictEqual([])
  })
})
