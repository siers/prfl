import { describe, expect, test } from 'vitest'
import { parseNote, render, rebase, Note, major, keysMajor, majorKey, semi, enharmonics } from './ToneLib.ts'

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
    expect(enharmonics(40).map(n => render(n))).toStrictEqual(['C4'])
    expect(enharmonics(41).map(n => render(n))).toStrictEqual(['Db4', 'C#4'])
    expect(enharmonics(55).map(n => render(n))).toStrictEqual(['Eb5'])
    expect(enharmonics(56).map(n => render(n))).toStrictEqual(['E5'])
  })

  test('rebase', () => {
    const c4 = parseNote('C4')!
    const c6 = parseNote('C6')!
    expect(rebase(c6, c4)).toStrictEqual(c4)

    keysMajor().flat().forEach(note => {
      expect(rebase(note, c4).octave).equal(4)
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

  // test('all notes', () => {
  //   const notes = objectUniq(t.allNotes()).sort((a, b) => b.semi - a.semi)
  //   expect(notes).equal(1)
  // })
})
