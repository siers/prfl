import { describe, expect, test } from 'vitest'
import { parseNote, render, rebase, Note, major, keysMajor, majorKey, semi, enharmonics, pointwiseInterval, rename, findMajor, equalNote, addInterval, majorKeyCentersPerLetter, majorKeyCentersWeighted, majorKeyCentersWeights } from './ToneLib.ts'

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
    expect(enharmonics(39).map(n => render(n))).toStrictEqual(['Cb3', 'B3'])
    expect(enharmonics(40).map(n => render(n))).toStrictEqual(['C4', 'B#4'])
    expect(enharmonics(41).map(n => render(n))).toStrictEqual(['C#4', 'Db4'])
    expect(enharmonics(55).map(n => render(n))).toStrictEqual(['D#5', 'Eb5'])
    expect(enharmonics(56).map(n => render(n))).toStrictEqual(['E5', 'Fb5'])
  })

  test('rebase', () => {
    const c4 = parseNote('C4')!
    const c6 = parseNote('C6')!
    expect(rebase(c6, c4)).toStrictEqual(c4)

    keysMajor().flat().forEach(note => {
      expect(rebase(note, c4).octave).equal(4)
    })
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

  test('majorKeyCentersPerLetter', () => {
    const r = (n: Note) => render(n, false)
    expect(majorKeyCentersPerLetter().map(g => g.map(r))).toStrictEqual([
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
    const r = (n: Note) => render(n, false)
    const shaped = majorKeyCentersWeighted().map(([natural, ...chunks]) =>
      [r(natural), ...chunks.map(([notes, weight]) => [notes.map(r), weight] as const)],
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
    const shaped = majorKeyCentersWeights().map(([n, w]) => [render(n, false), w])
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
})
