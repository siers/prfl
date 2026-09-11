import { describe, expect, test } from 'vitest'
import { denomToDuration, parseSheet, resolveColor, stringColors } from './SheetNotation'

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

describe('absolute frequencies', () => {
  test('a hz token carries its frequency and no note', () => {
    const { measures, errors } = parseSheet('<442hz>4')
    expect(errors).toStrictEqual([])
    expect(measures[0]).toStrictEqual([{ note: null, hz: 442, duration: 4 }])
  })

  test('fractional hz, for differences finer than a whole cycle', () => {
    expect(parseSheet('<440.5hz>4').measures[0][0].hz).toBe(440.5)
  })

  test('duration and dots work as on any other token', () => {
    const { measures } = parseSheet('<440hz>8 <440hz>2.')
    expect(measures[0].map(n => n.duration)).toStrictEqual([2, 12])
  })

  test('duration carries over, from and to named notes', () => {
    const { measures } = parseSheet('c8 <440hz> d')
    expect(measures[0].map(n => n.duration)).toStrictEqual([2, 2, 2])
  })

  test('octave marks are tolerated but ignored — an absolute pitch has no octave', () => {
    const { measures, errors } = parseSheet("<440hz>'4 <440hz>,4")
    expect(errors).toStrictEqual([])
    expect(measures[0].map(n => n.hz)).toStrictEqual([440, 440])
  })

  test('case is insensitive and bowing still attaches', () => {
    const { measures } = parseSheet('<440HZ>4v')
    expect(measures[0][0]).toStrictEqual({ note: null, hz: 440, duration: 4, bowing: 'up' })
  })

  test('a malformed frequency is an error, not a silent rest', () => {
    expect(parseSheet('<hz>4').errors.length).toBe(1)
    expect(parseSheet('<0hz>4').errors).toStrictEqual(['unusable frequency in: <0hz>4'])
    expect(parseSheet('<440hz>32').errors).toStrictEqual(['unusable duration in: <440hz>32'])
  })
})

describe('colour', () => {
  // The palette may be written in any case; what lands on a note is the normalised
  // form, so tests ask for that rather than comparing against the raw table.
  const stringColor = (name: string) => resolveColor(name)[0]

  test('the four violin strings each get their own colour', () => {
    const { measures, errors } = parseSheet("g,4[G] d4[D] a4[A] e'4[E]")

    expect(errors).toStrictEqual([])
    expect(measures[0].map(n => n.color)).toStrictEqual([
      stringColor('G'), stringColor('D'), stringColor('A'), stringColor('E'),
    ])
    // the point of a string palette: four notes, four distinguishable colours
    expect(new Set(measures[0].map(n => n.color)).size).toBe(4)
  })

  test('hex and keyword colours normalise to what musicxml accepts', () => {
    // MusicXML validates colour against /#[\dA-F]{6}.../ and silently drops anything
    // else, so keywords and #RGB shorthand have to be resolved here, not passed on.
    const { measures, errors } = parseSheet('c4[red] d4[#ff8800] e4[#F80] f4[GREY]')

    expect(errors).toStrictEqual([])
    expect(measures[0].map(n => n.color)).toStrictEqual(['#FF0000', '#FF8800', '#FF8800', '#808080'])
  })

  test('a string name is the string, not a note letter', () => {
    // `[E]` is the E string; the note it hangs off is unaffected
    const { measures } = parseSheet('c4[E]')
    expect(measures[0][0].note).toStrictEqual({ name: 'c', alter: 0, octave: 4 })
    expect(measures[0][0].color).toBe(stringColor('E'))
  })

  test('colour does not carry over the way duration does', () => {
    // duration is running state, colour is a mark on one note
    const { measures } = parseSheet('c8[G] d e')
    expect(measures[0].map(n => [n.duration, n.color])).toStrictEqual([
      [2, stringColor('G')], [2, undefined], [2, undefined],
    ])
  })

  test('colour composes with bowing and dots', () => {
    const { measures, errors } = parseSheet("a'8.v[A]")

    expect(errors).toStrictEqual([])
    expect(measures[0][0]).toStrictEqual({
      note: { name: 'a', alter: 0, octave: 5 }, duration: 3, bowing: 'up', color: stringColor('A'),
    })
  })

  test('colour composes with accidentals, both spellings', () => {
    const { measures, errors } = parseSheet('bes4[D] c#4[G]')

    expect(errors).toStrictEqual([])
    expect(measures[0].map(n => [n.note!.name, n.note!.alter, n.color])).toStrictEqual([
      ['b', -1, stringColor('D')], ['c', 1, stringColor('G')],
    ])
  })

  test('an unusable colour is reported, the note still lands', () => {
    const { measures, errors } = parseSheet('c4[nope!] d4')

    expect(measures[0].map(n => [n.note!.name, n.color])).toStrictEqual([
      ['c', undefined], ['d', undefined],
    ])
    expect(errors).toStrictEqual(['unusable colour: nope!'])
  })

  test('an empty bracket is an error, not a silent no-op', () => {
    expect(parseSheet('c4[]').errors).toStrictEqual(['empty colour'])
  })

  test('colour on a rest or a frequency has no notehead to paint', () => {
    expect(parseSheet('r4[G]').errors).toStrictEqual(['colour on a rest: r4[G]'])
    expect(parseSheet('<440hz>4[G]').errors).toStrictEqual(['colour on a frequency: <440hz>4[G]'])
  })

  test('resolveColor', () => {
    expect(resolveColor('G')).toStrictEqual([stringColors.G.toUpperCase(), null])
    expect(resolveColor('red')).toStrictEqual(['#FF0000', null])
    expect(resolveColor('#abcdef')).toStrictEqual(['#ABCDEF', null])
    expect(resolveColor('#ff88')).toStrictEqual([null, 'unusable colour: #ff88'])
    expect(resolveColor('')).toStrictEqual([null, 'empty colour'])
  })

  test('every colour it emits is one musicxml will accept', () => {
    // the schema's own pattern, which drops a non-matching attribute without complaint
    const musicXmlColor = /^#[\dA-F]{6}([\dA-F][\dA-F])?$/
    const specs = [...Object.keys(stringColors), 'red', 'green', 'grey', '#f80', '#ff8800']

    specs.forEach(spec => {
      const [resolved, error] = resolveColor(spec)
      expect(error, spec).toBeNull()
      expect(resolved, spec).toMatch(musicXmlColor)
    })
  })
})
