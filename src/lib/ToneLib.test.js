import { describe, expect, test } from 'vitest'
import ToneLib from './ToneLib.jsx'

const t = ToneLib

const objectUniq = objects => [...new Set(objects.map(JSON.stringify))].map(JSON.parse)

describe('ToneLib', () => {
  test('parse static', () => {
    expect(t.parseNote('c')).toStrictEqual({
      "alter": 0, "name": 0, "octave": 4, "render": "C4", "semi": 40
    })

    expect(t.parseNote('d')).toStrictEqual({
      "alter": 0, "name": 1, "octave": 4, "render": "D4", "semi": 42
    })

    expect(t.parseNote('G5')).toStrictEqual({
      "alter": 0, "name": 4, "octave": 5, "render": "G5", "semi": 59
    })

    expect({
      "alter": 0, "name": 4, "octave": 5, "render": "G5", "semi": 59
    }).toStrictEqual(t.parseNote('G5'))

    expect({
      "alter": -1, "name": 2, "octave": 5, "render": "Eb5", "semi": 55
    }).toStrictEqual(t.parseNote('Eb5'))
  })

  test('rebase', () => {
    const c4 = t.parseNote('C4')
    const c6 = t.parseNote('C6')
    expect(t.rebase(c6, c4.semi)).toStrictEqual(c4)

    t.keysMajor().flat().forEach(note => {
      expect(t.rebase(note, c4.semi).octave).equal(4)
    })
  })

  test('major', () => {
    expect(t.major()[0].render).equal('C4')
  })

  test('majorKey', () => {
    const d = t.parseNote('d')
    expect(t.majorKey(d)[0].render).toStrictEqual('D6')
  })

  // test('parse render on generated data', () => {
  //   t.keysMajor().flat().forEach(note => {
  //     console.log(note, note.render, t.parseNote(note.render))
  //     expect(note).toStrictEqual(t.parseNote(note.render))
  //   })
  // })

  // test('all notes', () => {
  //   const notes = objectUniq(t.allNotes()).sort((a, b) => b.semi - a.semi)
  //   expect(notes).equal(1)
  // })
})
