import { describe, expect, test } from 'vitest'
import _ from 'lodash'
import { parseNote, render, rebase, rebaseSemiByLetter, rebaseSemiByPitch, Note, major, keysMajor, majorKey, semi, enharmonics, pointwiseInterval, rename, findMajor, equalNote, addInterval, majorKeyCentersPerLetter, majorKeyCentersWeighted, majorKeyCentersWeights, chromaticScale, chromaticScaleZipMin, normalize, renderN, allNotes } from './ToneLib.ts'
import { directRange, zipT } from './Array.ts'

describe('ToneLib', () => {
  test('parse static', () => {
    expect(parseNote('c')).toStrictEqual({ "alter": 0, "name": 'c', "octave": 4 })
    expect(parseNote('d')).toStrictEqual({ "alter": 0, "name": 'd', "octave": 4 })
    expect(parseNote('G5')).toStrictEqual({ "alter": 0, "name": 'g', "octave": 5 })
  })

  test('semi', () => {
    expect(semi(parseNote('cb')!)).equal(39)
    expect(semi(parseNote('b#3')!)).equal(40)
    expect(semi(parseNote('c')!)).equal(40)
    expect(semi(parseNote('c#')!)).equal(41)
    expect(semi(parseNote('db')!)).equal(41)
    expect(semi(parseNote('d')!)).equal(42)
    expect(semi(parseNote('e')!)).equal(44)
    expect(semi(parseNote('f')!)).equal(45)
    expect(semi(parseNote('g')!)).equal(47)
    expect(semi(parseNote('a')!)).equal(49)
    expect(semi(parseNote('b')!)).equal(51)
  })

  test('enharmonics', () => {
    const range = directRange(semi(parseNote('c4')!), semi(parseNote('c5')!))
    expect(range.map(s => enharmonics(s).map(n => render(n)).join(' '))).toStrictEqual(
      [
        "C4 B#4",
        "C#4 Db4",
        "D4",
        "D#4 Eb4",
        "E4 Fb4",
        "F4 E#4",
        "F#4 Gb4",
        "G4",
        "G#4 Ab4",
        "A4",
        "A#4 Bb4",
        "Cb4 B4",
        "C5 B#5",
      ]
    )
  })

  test('rebase', () => {
    const c4 = parseNote('C4')!
    const c6 = parseNote('C6')!
    expect(rebase(c6, c4)).toStrictEqual(c4)

    keysMajor().flat().forEach(note => {
      expect(rebase(note, c4).octave).equal(4)
    })
  })

  // rebaseSemiByLetter and rebaseSemiByPitch share a contract (keep name+alter, shift only octave)
  // but choose the octave differently: ByLetter by letter-order spelling, ByPitch by actual pitch.
  // They agree for well-spelled notes and diverge for enharmonic misspellings like B# (spelled as
  // letter B, but sounds like C — a semitone up, in the next octave).
  test('rebaseSemiByLetter vs rebaseSemiByPitch diverge on B#', () => {
    const bSharp = parseNote('b#3')!    // sounds at semitone 40, same pitch as C4
    expect(semi(bSharp)).toBe(40)

    // target semitone 40 = C4's pitch
    const bySpelling = rebaseSemiByLetter(bSharp, 40)
    const byPitch = rebaseSemiByPitch(bSharp, 40)

    // ByLetter places B# in C4's *spelling* octave -> B#4, which actually sounds an octave too high
    expect(render(bySpelling)).toBe('B#4')
    expect(semi(bySpelling)).toBe(52)

    // ByPitch places B# so it truly sounds at 40 -> B#3
    expect(render(byPitch)).toBe('B#3')
    expect(semi(byPitch)).toBe(40)
  })

  test('addInterval', () => {
    const c = major()
    const ints = [1, 2, 3, 4, 5, 6, -1, -2, -3, -4, -5, -6]

    expect(render(addInterval(c[0], 5))).toBe('A4')
    expect(render(addInterval(c[0], -5))).toBe('E3')

    c.forEach(note => {
      expect(equalNote(note, addInterval(note, 0))).toBe(true)
      ints.forEach(int => {
        expect(equalNote(note, addInterval(note, int))).toBe(false)
      })
    })
  })

  test('major', () => {
    expect(render(major()[0])).equal('C4')
  })

  test('majorKey', () => {
    const d = parseNote('d')!
    const key = majorKey(d)!
    const tonic: Note = key![0]
    expect(render(tonic)).toStrictEqual('D4')
  })

  test('parse render on generated data', () => {
    keysMajor().flat().forEach(note => {
      expect(note).toStrictEqual(parseNote(render(note)))
    })
  })

  test('pointwiseInterval', () => {
    const c4 = parseNote('c4')!
    const e4 = parseNote('e4')!
    const c5 = parseNote('c5')!

    expect(pointwiseInterval(c4, c4).map(n => render(n))).toStrictEqual([])
    expect(pointwiseInterval(c4, e4).map(n => render(n))).toStrictEqual(['C4', 'D4', 'E4'])
    expect(pointwiseInterval(c4, c5).map(n => render(n))).toStrictEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'])
    expect(pointwiseInterval(c4, e4, c4).map(n => render(n))).toStrictEqual(['C4', 'D4', 'E4', 'D4', 'C4'])
  })

  test('rename', () => {
    const gb = findMajor(parseNote('gb')!)!
    expect(render(rename(parseNote('b')!, gb))).toEqual('Bb4')
  })

  test('minor key acceptance test & check differing roots', () => {
    const rootsForMode = (n: number) => keysMajor().map(k => normalize(k[n])).map(renderN)

    const all = allNotes().map(renderN)
    const majorRoots = new Set(rootsForMode(0))
    const minorRoots = new Set(rootsForMode(5))

    const majorOnlyRoots = [...majorRoots.difference(minorRoots)]
    const minorOnlyRoots = [...minorRoots.difference(majorRoots)]

    const notesWithoutRoots = [...new Set(all).difference(majorRoots.union(minorRoots))]

    expect(notesWithoutRoots).toStrictEqual(["E#", "B#", "Fb"])

    expect(majorOnlyRoots).toStrictEqual(["Db", "Gb", "Cb"])
    expect(minorOnlyRoots).toStrictEqual(["G#", "D#", "A#"])

    expect(rootsForMode(5)).toStrictEqual(
      [
        "A",
        "E",
        "D",
        "B",
        "G",
        "F#",
        "C",
        "C#",
        "F",
        "G#",
        "Bb",
        "D#",
        "Eb",
        "A#",
        "Ab",
      ]
    )
  })

  test('majorKeyCentersPerLetter', () => {
    expect(majorKeyCentersPerLetter().map(g => g.map(renderN))).toStrictEqual([
      ['Cb', 'C', 'C#'],
      ['Db', 'D'],
      ['Eb', 'E'],
      ['F', 'F#'],
      ['Gb', 'G'],
      ['Ab', 'A'],
      ['Bb', 'B'],
    ])
  })

  test('majorKeyCentersWeighted', () => {
    const shaped = majorKeyCentersWeighted().map(([natural, ...chunks]) =>
      [renderN(natural), ...chunks.map(([notes, weight]) => [notes.map(renderN), weight] as const)],
    )
    expect(shaped).toStrictEqual([
      ['C', [['C'], 0.5], [['Cb', 'C#'], 0.5]],
      ['D', [['D'], 0.5], [['Db'], 0.5]],
      ['E', [['E'], 0.5], [['Eb'], 0.5]],
      ['F', [['F'], 0.5], [['F#'], 0.5]],
      ['G', [['G'], 0.5], [['Gb'], 0.5]],
      ['A', [['A'], 0.5], [['Ab'], 0.5]],
      ['B', [['B'], 0.5], [['Bb'], 0.5]],
    ])

    // weights within each letter sum to 1
    majorKeyCentersWeighted().forEach(([, ...chunks]) => {
      expect(chunks.reduce((sum, [, w]) => sum + w, 0)).toBeCloseTo(1)
    })
  })

  test('majorKeyCentersWeights', () => {
    const shaped = majorKeyCentersWeights().map(([n, w]) => [renderN(n), w])
    expect(shaped).toStrictEqual([
      ['C', 0.5], ['Cb', 0.25], ['C#', 0.25],
      ['D', 0.5], ['Db', 0.5],
      ['E', 0.5], ['Eb', 0.5],
      ['F', 0.5], ['F#', 0.5],
      ['G', 0.5], ['Gb', 0.5],
      ['A', 0.5], ['Ab', 0.5],
      ['B', 0.5], ['Bb', 0.5],
    ])

    // every weighted note is a real tonic, weights per letter sum to 1
    const byLetter = Object.values(
      majorKeyCentersWeights().reduce<Record<string, number>>((acc, [n, w]) => {
        acc[n.name] = (acc[n.name] ?? 0) + w
        return acc
      }, {}),
    )
    expect(byLetter).toHaveLength(7)
    byLetter.forEach(sum => expect(sum).toBeCloseTo(1))
  })

  test('chromaticScale acceptance', () => {
    const chromaticExpected: Record<string, { up: string, down: string }> = {
      C: {
        up: 'C C# D D# E F F# G G# A A# B C',
        down: 'C B Bb A Ab G Gb F E Eb D Db C'
      },
      G: {
        up: 'G G# A A# B C C# D D# E E# F# G',
        down: 'G F# F E Eb D Db C B Bb A Ab G'
      },
      F: {
        up: 'F F# G G# A Bb B C C# D D# E F',
        down: 'F E Eb D Db C Cb Bb A Ab G Gb F'
      },
      D: {
        up: 'D D# E E# F# G G# A A# B B# C# D',
        down: 'D C# C B Bb A Ab G F# F E Eb D'
      },
      Bb: {
        up: 'Bb B C C# D Eb E F F# G G# A Bb',
        down: 'Bb A Ab G Gb F Fb Eb D Db C Cb Bb'
      },
      A: {
        up: 'A A# B B# C# D D# E E# F# F## G# A',
        down: 'A G# G F# F E Eb D C# C B Bb A'
      },
      Eb: {
        up: 'Eb E F F# G Ab A Bb B C C# D Eb',
        down: 'Eb D Db C Cb Bb Bbb Ab G Gb F Fb Eb'
      },
      E: {
        up: 'E E# F# F## G# A A# B B# C# C## D# E',
        down: 'E D# D C# C B Bb A G# G F# F E'
      },
      Ab: {
        up: 'Ab A Bb B C Db D Eb E F F# G Ab',
        down: 'Ab G Gb F Fb Eb Ebb Db C Cb Bb Bbb Ab'
      },
      B: {
        up: 'B B# C# C## D# E E# F# F## G# G## A# B',
        down: 'B A# A G# G F# F E D# D C# C B'
      },
      Db: {
        up: 'Db D Eb E F Gb G Ab A Bb B C Db',
        down: 'Db C Cb Bb Bbb Ab Abb Gb F Fb Eb Ebb Db'
      },
      'F#': {
        up: 'F# F## G# G## A# B B# C# C## D# D## E# F#',
        down: 'F# E# E D# D C# C B A# A G# G F#'
      },
      Gb: {
        up: 'Gb G Ab A Bb Cb C Db D Eb E F Gb',
        down: 'Gb F Fb Eb Ebb Db Dbb Cb Bb Bbb Ab Abb Gb'
      },
      'C#': {
        up: 'C# C## D# D## E# F# F## G# G## A# A## B# C#',
        down: 'C# B# B A# A G# G F# E# E D# D C#'
      },
      Cb: {
        up: 'Cb C Db D Eb Fb F Gb G Ab A Bb Cb',
        down: 'Cb Bb Bbb Ab Abb Gb Gbb Fb Eb Ebb Db Dbb Cb'
      },
    }

    Object.entries(chromaticExpected).forEach(([tonic, want]) => {
      const { up, down } = chromaticScale(findMajor(parseNote(tonic)!)!)
      const spell = (ns: Note[]) => ns.map(n => renderN(n)).join(' ')
      expect(spell(up)).toBe(want.up)
      expect(spell(down)).toBe(want.down)

      up.forEach((n, i) => i && expect(semi(n) - semi(up[i - 1])).toBe(1))
      down.forEach((n, i) => i && expect(semi(down[i - 1]) - semi(n)).toBe(1))
    })

    expect(Object.keys(chromaticExpected)).toHaveLength(keysMajor().length)
  })

  test('chromaticScaleZipMin acceptance', () => {
    const cells = (row: string) => row.trim().split(/\s+/).join(' ')
    const zipMinExpected: Record<string, string> = {
      'C ': 'C   C#  D   D#  E   F   F#  G   Ab  A   Bb  B   C',
      'G ': 'G   G#  A   A#  B   C   C#  D   Eb  E   F   F#  G',
      'F ': 'F   F#  G   G#  A   Bb  B   C   Db  D   Eb  E   F',
      'D ': 'D   D#  E   F   F#  G   G#  A   Bb  B   C   C#  D',
      'Bb': 'Bb  B   C   C#  D   Eb  E   F   Gb  G   Ab  A   Bb',
      'A ': 'A   A#  B   C   C#  D   D#  E   F   F#  G   G#  A',
      'Eb': 'Eb  E   F   F#  G   Ab  A   Bb  B   C   Db  D   Eb',
      'E ': 'E   F   F#  G   G#  A   A#  B   C   C#  D   D#  E',
      'Ab': 'Ab  A   Bb  B   C   Db  D   Eb  E   F   Gb  G   Ab',
      'B ': 'B   C   C#  D   D#  E   F   F#  G   G#  A   A#  B',
      'Db': 'Db  D   Eb  E   F   Gb  G   Ab  A   Bb  B   C   Db',
      'F#': 'F#  G   G#  A   A#  B   C   C#  D   D#  E   E#  F#',
      'Gb': 'Gb  G   Ab  A   Bb  Cb  C   Db  D   Eb  E   F   Gb',
      'C#': 'C#  D   D#  E   E#  F#  G   G#  A   A#  B   B#  C#',
      'Cb': 'Cb  C   Db  D   Eb  Fb  F   Gb  G   Ab  A   Bb  Cb',
    }

    // the same scales rotated so the first note is always the one sharing C's semitone
    const zipMinRotatedExpected: Record<string, string> = {
      'C ': 'C   C#  D   D#  E   F   F#  G   Ab  A   Bb  B   C',
      'G ': 'C   C#  D   Eb  E   F   F#  G   G#  A   A#  B   C',
      'F ': 'C   Db  D   Eb  E   F   F#  G   G#  A   Bb  B   C',
      'D ': 'C   C#  D   D#  E   F   F#  G   G#  A   Bb  B   C',
      'Bb': 'C   C#  D   Eb  E   F   Gb  G   Ab  A   Bb  B   C',
      'A ': 'C   C#  D   D#  E   F   F#  G   G#  A   A#  B   C',
      'Eb': 'C   Db  D   Eb  E   F   F#  G   Ab  A   Bb  B   C',
      'E ': 'C   C#  D   D#  E   F   F#  G   G#  A   A#  B   C',
      'Ab': 'C   Db  D   Eb  E   F   Gb  G   Ab  A   Bb  B   C',
      'B ': 'C   C#  D   D#  E   F   F#  G   G#  A   A#  B   C',
      'Db': 'C   Db  D   Eb  E   F   Gb  G   Ab  A   Bb  B   C',
      'F#': 'C   C#  D   D#  E   E#  F#  G   G#  A   A#  B   C',
      'Gb': 'C   Db  D   Eb  E   F   Gb  G   Ab  A   Bb  Cb  C',
      'C#': 'B#  C#  D   D#  E   E#  F#  G   G#  A   A#  B   B#',
      'Cb': 'C   Db  D   Eb  Fb  F   Gb  G   Ab  A   Bb  Cb  C',
    }

    const cPc = ((semi(parseNote('C')!) % 12) + 12) % 12
    const rotateToC = (scale: Note[]) => {
      const uniq = scale.slice(0, -1) // drop the duplicated closing octave note
      const i = uniq.findIndex(n => ((semi(n) % 12) + 12) % 12 === cPc)
      const rot = [...uniq.slice(i), ...uniq.slice(0, i)]
      return [...rot, rot[0]] // re-close the octave
    }

    Object.entries(zipMinExpected).forEach(([tonic, want]) => {
      const scale = chromaticScaleZipMin(findMajor(parseNote(tonic.trim())!)!)
      expect(scale.map(n => renderN(n)).join(' ')).toBe(cells(want))

      const rotated = rotateToC(scale)
      expect(rotated.map(n => renderN(n)).join(' ')).toBe(cells(zipMinRotatedExpected[tonic]))
      expect(((semi(rotated[0]) % 12) + 12) % 12).toBe(cPc)

      scale.forEach((n, i) => {
        expect(Math.abs(n.alter)).toBeLessThanOrEqual(1)
        if (i) expect(semi(n) - semi(scale[i - 1])).toBe(1)
      })
    })

    expect(Object.keys(zipMinExpected)).toHaveLength(keysMajor().length)
    expect(Object.keys(zipMinRotatedExpected)).toHaveLength(keysMajor().length)
  })

  // "black keys": the complement of the chromatic scale against the major scale for that key —
  // flat preference: sharp only when strictly fewer accidentals, else flat
  test('black keys acceptance', () => {
    const blackKeysExpected: Record<string, string> = {
      'C ': 'Db Eb Gb Ab Bb',
      'G ': 'Ab Bb Db Eb F',
      'F ': 'Gb Ab B Db Eb',
      'D ': 'Eb F Ab Bb C',
      'Bb': 'B Db E Gb Ab',
      'A ': 'Bb C Eb F G',
      'Eb': 'E Gb A B Db',
      'E ': 'F G Bb C D',
      'Ab': 'A B D E Gb',
      'B ': 'C D F G A',
      'Db': 'D E G A B',
      'F#': 'G A C D E',
      'Gb': 'G A C D E',
      'C#': 'D E G A B',
      'Cb': 'C D F G A',
    }

    Object.entries(blackKeysExpected).forEach(([tonic, want]) => {
      const key = findMajor(parseNote(tonic.trim())!)!

      const { up, down } = chromaticScale(key)
      const black = zipT(up, [...down].reverse())
        .map(([sharp, flat]) => Math.abs(sharp.alter) < Math.abs(flat.alter) ? sharp : flat)
        .filter(n => !key.some(m => semi(normalize(m)) == semi(normalize(n))))

      expect(black.map(n => renderN(n)).join(' ')).toBe(want)
      expect(black).toHaveLength(5)
      black.forEach(n => expect(key.some(m => semi(normalize(m)) == semi(normalize(n)))).toBe(false))
    })

    expect(Object.keys(blackKeysExpected)).toHaveLength(keysMajor().length)
  })
})
