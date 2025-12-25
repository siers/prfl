import { describe, expect, test } from 'vitest'
import { allNotesRendered, keysMajor, majorKey, nameLeadingDim7, notesMissing, parseNote, render } from './ToneLib.ts'
import Immutable from 'immutable'

function pad(str: string, size: number, with_: string): string {
  var s = str
  while (s.length < size) s = with_ + s
  return s
}

describe('ToneLib computations', () => {
  test('allNotes', () => {
    expect([...allNotesRendered()]).toStrictEqual(
      ["C#", "Bb", "A", "Ab", "A#", "B", "C", "D", "E", "F", "G", "Gb", "G#", "F#", "Eb", "E#", "Db", "D#", "Cb"])
  })

  test('keysMajor', () => {
    expect(keysMajor().map(k => k.map(n => pad(render(n), 4, ' ')).join(' '))).toStrictEqual(
      [
        "  C4   D4   E4   F4   G4   A4   B4",
        "  G4   A4   B4   C5   D5   E5  F#5",
        "  F4   G4   A4  Bb4   C5   D5   E5",
        "  D4   E4  F#4   G4   A4   B4  C#5",
        " Bb4   C5   D5  Eb5   F5   G5   A5",
        "  A4   B4  C#5   D5   E5  F#5  G#5",
        " Eb4   F4   G4  Ab4  Bb4   C5   D5",
        "  E4  F#4  G#4   A4   B4  C#5  D#5",
        " Ab4  Bb4   C5  Db5  Eb5   F5   G5",
        "  B4  C#5  D#5   E5  F#5  G#5  A#5",
        " Db4  Eb4   F4  Gb4  Ab4  Bb4   C5",
        " F#4  G#4  A#4   B4  C#5  D#5  E#5",
        " Gb4  Ab4  Bb4  Cb5  Db5  Eb5   F5",
      ]
    )
  })

  test('nameLeadingDim7', () => {
    expect(nameLeadingDim7()).toStrictEqual(
      [
        "E4 G4 Bb4 Db4",
        "B4 D5 F5 Ab4",
        "A4 C5 Eb5 Gb4",
        "F#4 A4 C5 Eb4",
        "D5 F5 Ab5 Cb5",
        "C#5 E5 G5 Bb4",
        "G4 Bb4 Db5 Fb4",
        "G#4 B4 D5 F4",
        "C5 Eb5 Gb5 Bbb4",
        "D#5 F#5 A5 C5",
        "F4 Ab4 Cb5 Ebb4",
        "A#4 C#5 E5 G4",
        "Bb4 Db5 Fb5 Abb4",
      ]
    )
  })

  test('missing from Bb and D', () => {
    const bb = majorKey(parseNote('bb')!)!
    const d = majorKey(parseNote('d')!)!
    expect(Immutable.Set.of("Ab", "A#", "Gb", "G#", "E#", "Db", "D#", "Cb").equals(notesMissing(bb, d))).equal(true)
  })
})


// ToneLib.noteKeyAssociations().map(kAndKs => console.log(`${kAndKs[0]}: ${kAndKs[1].join(',')}`))
// Ab: Eb,Ab,Db,Gb
// G#: A,E,B,F#
//
// Bb: F,Bb,Eb,Ab,Db,Gb
// A#: B,F#
//
// Db: Ab,Db,Gb
// C#: D,A,E,B,F#
//
// Eb: Bb,Eb,Ab,Db,Gb
// D#: E,B,F#
//
// F#: G,D,A,E,B,F#
// Gb: Db,Gb
//
// C: C,G,F,Bb,Eb,Ab,Db
// D: C,G,F,D,Bb,A,Eb
// E: C,G,F,D,A,E,B
//
// F: C,F,Bb,Eb,Ab,Db,Gb
// E#: F#
//
// G: C,G,F,D,Bb,Eb,Ab
// A: C,G,F,D,Bb,A,E
//
// B: C,G,D,A,E,B,F#
// Cb: Gb

// modulateFifth(major, -1).map(n => log(JSON.stringify(n) + ' ' + render(n)))
// log()
// modulateFifth(major, 1).map(n => log(JSON.stringify(n) + ' ' + render(n)))
  // log(keysMajor.map(k => render(k[0])).join())
