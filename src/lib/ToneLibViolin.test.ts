import { describe, expect, test } from 'vitest'
import { embedNote, fingerPosition, findTriadOnString, frets, positionsQuiz, shifts, StringName, strings, stringsAboveOpen, stringsForTonality, modeShifts, modeShiftsGen, ModeShift, serializeModeShift, deserializeModeShift } from './ToneLibViolin.ts'
import { findMajor, Key, parseNote, render } from './ToneLib.ts'
import { shuffleArray } from './Random.tsx'
import { transpose } from './Array.ts'
import _ from 'lodash'

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

  describe('fingerPosition', () => {
    const table: [StringName, string, number | undefined, number, number][] = [
      ['G', 'G3', undefined, 1, 0],
      ['G', 'A3', undefined, 1, 1],
      ['G', 'B3', undefined, 1, 2],
      ['G', 'C4', undefined, 2, 2],
      ['G', 'F#4', undefined, 5, 2],
      ['G', 'G#3', undefined, 0, 1],
      ['E', 'G6', 4, 6, 4],
      ['E', 'F#7', 4, 12, 4],
      ['E', 'E5', 4, -3, 4],
    ]

    table.forEach(([string, note, finger, position, expectedFinger]) => {
      test(`${string} string ${note}${finger ? ` finger ${finger}` : ''}`, () => {
        const fp = fingerPosition(string, parseNote(note)!, finger)!

        expect(fp.string).toBe(string)
        expect(render(fp.note)).toBe(note)
        expect(fp.finger).toBe(expectedFinger)
        expect(fp.position).toBe(position)
      })
    })

    test('returns null off the gamut', () => {
      expect(fingerPosition('G', parseNote('c1')!)).toBeNull()
      expect(fingerPosition('E', parseNote('c9')!)).toBeNull()
    })

    type ShiftRow = [StringName, string, number, number, StringName, string, number, number, number]

    const shiftTable: ShiftRow[] = [
      ['G', 'A3', 1, 1, 'E', 'A5', 2, 2, 1],
      ['G', 'G3', 0, 1, 'E', 'G6', 4, 6, 5],
      ['G', 'B3', 2, 1, 'E', 'B6', 4, 8, 7],
      ['G', 'A3', 1, 1, 'G', 'A3', 1, 1, 0],
      ['E', 'A5', 2, 2, 'G', 'A3', 1, 1, -1],
    ]

    shiftTable.forEach(([sStr, sNote, sFing, sPos, eStr, eNote, eFing, ePos, count]) => {
      test(`${sNote}:${sStr}:${sFing} to ${eNote}:${eStr}:${eFing} is ${count}`, () => {
        const start = fingerPosition(sStr, parseNote(sNote)!, sFing)!
        const end = fingerPosition(eStr, parseNote(eNote)!, eFing)!

        expect(start.position).toBe(sPos)
        expect(end.position).toBe(ePos)
        expect(shifts(start, end)).toBe(count)
      })
    })

    test('A1 is unplayable on the G string', () => {
      expect(fingerPosition('G', parseNote('a1')!, 1)).toBeNull()
    })
  })

  describe('embedNote', () => {
    const embedRender = (note: string, restrict?: StringName[]) =>
      embedNote(parseNote(note)!, restrict).map(sen => `${sen.string.name}${sen.position}`).join(' ')

    test('embeds a note onto every string', () => {
      expect(embedRender('C4')).toBe('G3')
      expect(embedRender('E4')).toBe('G5 D1')
      expect(embedRender('G4')).toBe('G7 D3')
      expect(embedRender('Bb4')).toBe('G9 D5 A1')
    })

    // test('restricts to the given strings', () => {
    //   expect(embedRender('A', ['G'])).toBe('G1')
    //   expect(embedRender('A', ['A'])).toBe('A4')
    //   expect(embedRender('A', ['G', 'E'])).toBe('G1 E1')
    //   expect(embedNote(parseNote('A')!, [])).toStrictEqual([])
    // })

    test('position is chosen by letter, so enharmonics collapse', () => {
      expect(embedRender('Bb')).toBe(embedRender('B'))
      expect(embedRender('B#')).toBe(embedRender('B'))
      expect(embedRender('F#')).toBe(embedRender('F'))
      expect(embedRender('Fb')).toBe(embedRender('F'))
    })
  })

  describe('ModeShift serialization', () => {
    const ms: ModeShift = {
      modeNr: 2, // phr is modes[2]
      mode: 'phr',
      scale: 'maj',
      start: 2,
      end: 4,
      shifts: 5,
      additional: 'ab'
    }
    const serialized = 'phr.maj:24;s5:aab'

    test('serializes', () => {
      expect(serializeModeShift(ms)).toBe(serialized)
    })

    test('deserializes', () => {
      expect(deserializeModeShift(serialized)).toStrictEqual(ms)
    })

    test('round-trips', () => {
      expect(deserializeModeShift(serializeModeShift(ms))).toStrictEqual(ms)
      expect(serializeModeShift(deserializeModeShift(serialized))).toBe(serialized)
    })

    test('round-trips every modesAndShifts return', () => {
      modeShifts(findMajor(parseNote('d')!)!, 'maj pos').forEach(str =>
        expect(serializeModeShift(deserializeModeShift(str))).toBe(str)
      )
    })

    test('chrom scale shows chromShifts', () => {
      modeShiftsGen(findMajor(parseNote('d')!)!, 'chrom').forEach(ms =>
        expect(ms.shifts).toBe(ms.chromShifts)
      )
    })
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
