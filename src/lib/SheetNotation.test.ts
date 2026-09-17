import { describe, expect, test } from 'vitest'
import { denomToDuration, parseMarks, parseSheet, redivide, resolveColor, rotate, rotateSheet, SheetMeasure, stringColors } from './SheetNotation'
import { sumsTo } from './Combinatorics'

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

describe('notehead shape', () => {
  test('a bracketed x is a crossed notehead', () => {
    const { measures, errors } = parseSheet('c4[x] d4')

    expect(errors).toStrictEqual([])
    expect(measures[0].map(n => n.shape)).toStrictEqual(['x', undefined])
  })

  test('shape and colour are different kinds, so both fit in brackets', () => {
    // the point of sorting a bracket by its content: `[x][G]` is two marks, not a repeat
    const { measures, errors } = parseSheet('c4[x][G] d4[G][x]')

    expect(errors).toStrictEqual([])
    expect(measures[0].map(n => [n.shape, n.color])).toStrictEqual([
      ['x', resolveColor('G')[0]], ['x', resolveColor('G')[0]],
    ])
  })

  test('a repeated shape is still a repeat', () => {
    expect(parseSheet('c4[x][x]').errors).toStrictEqual(['repeated shape: [x][x]'])
    expect(parseSheet('c4[x][x]').measures[0][0].shape).toBe('x')
  })

  test('uppercase [X] stays the colour slot — [E] must remain the E string', () => {
    // shapes are matched case-sensitively so they cannot shadow a violin string name
    const { measures, errors } = parseSheet('c4[X]')

    expect(measures[0][0].shape).toBeUndefined()
    expect(errors).toStrictEqual(['unusable colour: X'])
  })

  test('shape composes with bowing, dots, accidentals and text', () => {
    const { measures, errors } = parseSheet("bes'8.v[x][A]{4}")

    expect(errors).toStrictEqual([])
    expect(measures[0][0]).toStrictEqual({
      note: { name: 'b', alter: -1, octave: 5 },
      duration: 3, bowing: 'up', color: resolveColor('A')[0], shape: 'x', text: '4',
    })
  })

  test('shape does not carry over the way duration does', () => {
    const { measures } = parseSheet('c8[x] d e')
    expect(measures[0].map(n => [n.duration, n.shape])).toStrictEqual([
      [2, 'x'], [2, undefined], [2, undefined],
    ])
  })

  test('shape on a rest or a frequency has no notehead to draw', () => {
    expect(parseSheet('r4[x]').errors).toStrictEqual(['shape on a rest: r4[x]'])
    expect(parseSheet('<440hz>4[x]').errors).toStrictEqual(['shape on a frequency: <440hz>4[x]'])
  })

  test('parseMarks sorts a bracket into shape or colour by its content', () => {
    expect(parseMarks('[x]')).toStrictEqual([{ shape: 'x' }, []])
    expect(parseMarks('[G]')).toStrictEqual([{ color: 'G' }, []])
    expect(parseMarks('[x][G]{1}')).toStrictEqual([{ shape: 'x', color: 'G', text: '1' }, []])
  })
})

describe('text', () => {
  test('parenthesised text rides along as a fingering', () => {
    const { measures, errors } = parseSheet('c4{1} d4{3} e4')

    expect(errors).toStrictEqual([])
    expect(measures[0].map(n => n.text)).toStrictEqual(['1', '3', undefined])
  })

  test('text is not only digits', () => {
    // whatever is written engraves verbatim; the parser does not police it
    const { measures, errors } = parseSheet('c4{2-3} d4{IV} e4{o}')

    expect(errors).toStrictEqual([])
    expect(measures[0].map(n => n.text)).toStrictEqual(['2-3', 'IV', 'o'])
  })

  test('text and colour commute — parentheses keep them apart', () => {
    const { measures, errors } = parseSheet('c4[G]{1} d4{1}[G]')

    expect(errors).toStrictEqual([])
    expect(measures[0].map(n => [n.color, n.text])).toStrictEqual([
      [resolveColor('G')[0], '1'], [resolveColor('G')[0], '1'],
    ])
  })

  test('text composes with bowing, dots and accidentals', () => {
    const { measures, errors } = parseSheet("bes'8.v[A]{4}")

    expect(errors).toStrictEqual([])
    expect(measures[0][0]).toStrictEqual({
      note: { name: 'b', alter: -1, octave: 5 },
      duration: 3, bowing: 'up', color: resolveColor('A')[0], text: '4',
    })
  })

  test('text does not carry over the way duration does', () => {
    const { measures } = parseSheet('c8{1} d e')
    expect(measures[0].map(n => [n.duration, n.text])).toStrictEqual([
      [2, '1'], [2, undefined], [2, undefined],
    ])
  })

  test('empty parentheses are an error, not an empty fingering on the staff', () => {
    expect(parseSheet('c4{}').errors).toStrictEqual(['empty text: c4{}'])
    expect(parseSheet('c4{}').measures[0][0].text).toBeUndefined()
  })

  test('a repeated mark is reported rather than silently last-one-wins', () => {
    expect(parseSheet('c4{1}{2}').errors).toStrictEqual(['repeated text: {1}{2}'])
    expect(parseSheet('c4[G][E]').errors).toStrictEqual(['repeated colour: [G][E]'])

    // the first spelling is what lands, and the note still lands
    expect(parseSheet('c4{1}{2}').measures[0][0].text).toBe('1')
  })

  test('text on a rest or a frequency has nothing to hang off', () => {
    expect(parseSheet('r4{1}').errors).toStrictEqual(['text on a rest: r4{1}'])
    expect(parseSheet('<440hz>4{1}').errors).toStrictEqual(['text on a frequency: <440hz>4{1}'])
  })

  test('parseMarks reads either order and both kinds', () => {
    expect(parseMarks('[G]{1}')).toStrictEqual([{ color: 'G', text: '1' }, []])
    expect(parseMarks('{1}[G]')).toStrictEqual([{ color: 'G', text: '1' }, []])
    expect(parseMarks('')).toStrictEqual([{}, []])
  })
})

describe('ties', () => {
  test('a trailing ~ marks the note as tied to the next', () => {
    const { measures, errors } = parseSheet('c4~ c4')
    expect(errors).toStrictEqual([])
    expect(measures[0].map(n => [n.duration, !!n.tied])).toStrictEqual([[4, true], [4, false]])
  })

  test('the tie comes after the marks, and does not consume them', () => {
    const { measures, errors } = parseSheet('c4[G]{3}~ c4')
    expect(errors).toStrictEqual([])
    expect(measures[0][0]).toMatchObject({ color: stringColors.G.toUpperCase(), text: '3', tied: true })
  })

  test('a tie carries across a bar line', () => {
    const { measures, errors } = parseSheet('c2 c2~ | c1')
    expect(errors).toStrictEqual([])
    expect(measures.map(m => m.map(n => !!n.tied))).toStrictEqual([[false, true], [false]])
  })

  test('a frequency can be tied too', () => {
    const { measures, errors } = parseSheet('<442hz>8~ <442hz>8')
    expect(errors).toStrictEqual([])
    expect(measures[0].map(n => !!n.tied)).toStrictEqual([true, false])
  })

  test('a tie on a rest is an error — nothing is held through a rest', () => {
    expect(parseSheet('r4~ c4').errors).toStrictEqual(['tie on a rest: r4~'])
  })

  test('a tie on the last note binds to nothing', () => {
    expect(parseSheet('c4 c4~').errors).toStrictEqual(['tie on the last note, binding to nothing'])
  })

  test('an untied line has no tied notes', () => {
    const { measures } = parseSheet('c4 c4')
    expect(measures[0].every(n => n.tied === undefined)).toBe(true)
  })
})

describe('slurs', () => {
  test('( opens and ) closes, LilyPond-style', () => {
    const { measures, errors } = parseSheet('c8( d e f)')
    expect(errors).toStrictEqual([])
    expect(measures[0].map(n => [n.slurStart ?? 0, n.slurStop ?? 0]))
      .toStrictEqual([[1, 0], [0, 0], [0, 0], [0, 1]])
  })

  test('a slur changes no duration — it is a phrase mark, not a tie', () => {
    expect(parseSheet('c8( d e f)').measures[0].map(n => n.duration))
      .toStrictEqual(parseSheet('c8 d e f').measures[0].map(n => n.duration))
  })

  test('slurs nest', () => {
    const { measures, errors } = parseSheet('c8(( d f))')
    expect(errors).toStrictEqual([])
    expect(measures[0].map(n => [n.slurStart ?? 0, n.slurStop ?? 0]))
      .toStrictEqual([[2, 0], [0, 0], [0, 2]])
  })

  test('one note can end a slur and open the next', () => {
    const { errors, measures } = parseSheet('c8( d8)( e8)')
    expect(errors).toStrictEqual([])
    expect(measures[0][1]).toMatchObject({ slurStart: 1, slurStop: 1 })
  })

  test('a slur opened and closed on one note is written ()', () => {
    const { errors, measures } = parseSheet('c8() d8')
    expect(errors).toStrictEqual([])
    expect(measures[0][0]).toMatchObject({ slurStart: 1, slurStop: 1, slurOpensFirst: true })
  })

  test('the order tells () from )( — the latter closes nothing', () => {
    expect(parseSheet('c8() d8').errors).toStrictEqual([])
    expect(parseSheet('c8)( d8').errors).toStrictEqual(['slur closed that was never opened'])
  })

  test('an unclosed slur is reported', () => {
    expect(parseSheet('c8( d e f').errors).toStrictEqual(['slur never closed: 1 left open'])
  })

  test('a slur closed that was never opened is reported', () => {
    expect(parseSheet('c8 d) e').errors).toStrictEqual(['slur closed that was never opened'])
  })

  test('a slur spans a bar line', () => {
    expect(parseSheet('c2( c2 | c1)').errors).toStrictEqual([])
  })

  test('a slur on a rest is an error', () => {
    expect(parseSheet('r4( c4)').errors).toContain('slur on a rest: r4(')
  })

  test('slur and tie commute, and both may sit on one note', () => {
    for (const src of ['c4~( c4)', 'c4(~ c4)']) {
      const { measures, errors } = parseSheet(src)
      expect(errors, src).toStrictEqual([])
      expect(measures[0][0], src).toMatchObject({ tied: true, slurStart: 1 })
    }
  })

  test('a repeated tie is reported rather than silently accepted', () => {
    expect(parseSheet('c4~~ c4').errors).toStrictEqual(['repeated tie: c4~~'])
  })

  test('slurs ride along with the other marks in any order', () => {
    const { measures, errors } = parseSheet('c4[G]{1}( d4)')
    expect(errors).toStrictEqual([])
    expect(measures[0][0]).toMatchObject({ color: stringColors.G.toUpperCase(), text: '1', slurStart: 1 })
  })
})

// Reads a line back as notation, so a rotation can be asserted as the text a player
// would see rather than as a tree of objects.
const denoms: Record<number, string> = {
  1: '16', 2: '8', 3: '8.', 4: '4', 6: '4.', 7: '4..', 8: '2', 12: '2.', 14: '2..', 16: '1',
}

const show = (measures: SheetMeasure[]): string =>
  measures.map(m => m.map(n => {
    const alter = n.note ? (n.note.alter > 0 ? '#'.repeat(n.note.alter) : 'b'.repeat(-n.note.alter)) : ''
    const octave = n.note ? (n.note.octave > 4 ? "'".repeat(n.note.octave - 4) : ','.repeat(4 - n.note.octave)) : ''
    return (n.note ? n.note.name + alter + octave : 'r') + denoms[n.duration] + (n.tied ? '~' : '')
  }).join(' ')).join(' | ')

const rot = (src: string, by: number) => show(rotateSheet(parseSheet(src).measures, by))

describe('rotateSheet', () => {
  test('notes move by the given number of sixteenths, wrapping round the line', () => {
    expect(rot('c4 d4 e4 f4 | g4 a4 b4 c4', 4)).toBe('c4 c4 d4 e4 | f4 g4 a4 b4')
  })

  test('the bar lines stay put — only the material moves', () => {
    const src = 'c4 d4 e4 f4 | g2'
    const lengths = (s: string) =>
      parseSheet(s).measures.map(m => m.reduce((a, n) => a + n.duration, 0))

    expect(lengths(src)).toStrictEqual([16, 8])
    for (let by = -24; by <= 24; by++)
      expect(rotateSheet(parseSheet(src).measures, by).map(m => m.reduce((a, n) => a + n.duration, 0)))
        .toStrictEqual([16, 8])
  })

  test('a rotation of the whole length is the identity', () => {
    const src = 'c4 d8 e8 f2 | g4 a4 b2'   // 16 + 16 sixteenths
    expect(rot(src, 0)).toBe(show(parseSheet(src).measures))
    expect(rot(src, 32)).toBe(show(parseSheet(src).measures))
  })

  test('negative rotates backwards', () => {
    expect(rot('c4 d4 e4 f4', -4)).toBe('d4 e4 f4 c4')
    expect(rot('c4 d4 e4 f4', 4)).toBe('f4 c4 d4 e4')
  })

  test('a note cut by a beat line comes back tied, not re-articulated', () => {
    // One quarter landing off the beat is an eighth tied to an eighth, not two eighths.
    // The final f8 is NOT tied: its other half wrapped to the front of the line, and a
    // tie across the wrap is the one thing a rotation cannot keep.
    expect(rot('c4 d4 e4 f4', 2)).toBe('f8 c8~ c8 d8~ d8 e8~ e8 f8')
  })

  test('a held note stays held when it moves', () => {
    // The written tie makes one c of two on the grid, so it re-spells as one note.
    expect(rot('c4~ c4 d2', 8)).toBe('d2 c2')
  })

  test('a note the wrap cuts in half becomes two notes', () => {
    // The d spans the wrap and becomes two notes; the c, moved across the bar line, is
    // still one note and comes back tied.
    expect(rot('c1 | d1', 4)).toBe('d4 c2.~ | c4 d2.')
  })

  test('the first note loses a tie it had into the previous note — the wrap breaks it', () => {
    // `d2~` held into the following bar; rotated to the front there is nothing behind it.
    const out = rotateSheet(parseSheet('c2 d2~ | d1').measures, 0)
    expect(out[0][1].tied).toBe(true)

    const rotated = rotateSheet(parseSheet('c2 d2~ | d1').measures, 8)
    expect(rotated[0][0].tied).toBeUndefined()
  })

  test('rests move like anything else', () => {
    expect(rot('c4 r4 d4 r4', 4)).toBe('r4 c4 r4 d4')
  })

  test('slurs do not survive — their spans no longer mean anything', () => {
    const out = rotateSheet(parseSheet('c8( d8 e8 f8) g2').measures, 4)
    expect(out.flat().every(n => n.slurStart === undefined && n.slurStop === undefined)).toBe(true)
  })

  test('the sounding content is the grid, rotated — nothing is gained or lost', () => {
    const pitches = (ms: SheetMeasure[]) =>
      redivide(ms).map(s => s.note ? `${s.note.note!.name}${s.note.note!.octave}` : 'r')

    const src = parseSheet('c4 d8 e8 f2 | g4 r4 b2').measures
    for (let by = -24; by <= 24; by++)
      expect(pitches(rotateSheet(src, by)), `by ${by}`).toStrictEqual(rotate(redivide(src), by)
        .map(s => s.note ? `${s.note.note!.name}${s.note.note!.octave}` : 'r'))
  })

  test('every rotation is legible against the beat', () => {
    const src = parseSheet('c16 d16 e8 f4 g2 | a8. b16 c4 d2').measures

    for (let by = -32; by <= 32; by++) {
      for (const measure of rotateSheet(src, by)) {
        let at = 0
        for (const note of measure) {
          const crosses = Math.floor(at / 4) != Math.floor((at + note.duration - 1) / 4)
          if (crosses) expect([at % 4, note.duration], `by ${by}`).toStrictEqual([0, note.duration])
          at += note.duration
        }
      }
    }
  })

  test('every rotation parses back, so a rotation is always writable', () => {
    const src = parseSheet('c8. d16 e4 f2 | g4 a4 b2').measures
    for (let by = -24; by <= 24; by++) {
      const text = show(rotateSheet(src, by)).replace(/ \| /g, ' | ')
      expect(parseSheet(text).errors, `by ${by}: ${text}`).toStrictEqual([])
    }
  })
})

// On the grid rotation is addition, so any barrage of steps summing to the length is the
// identity — `sumsTo` enumerates every such splitting.
describe('rotate — a barrage summing to the length is the identity', () => {
  const content = (slots: ReturnType<typeof redivide>) =>
    slots.map(s => s.note ? `${s.note.note!.name}${s.note.note!.octave}` : 'r').join(' ')

  test.each([
    'c4 d4 e4 f4',
    'c16 d16 e8 f4 g2',
    'c8. d16 e4 f2',
    'c4~ c4 d2',
    'c4 r8 d8 e4 f4',
    'c4 d8 e8 f2 | g4 r4 b2',
    'c4 d4 e4 f4 | g2',
  ])('%s', src => {
    const grid = redivide(parseSheet(src).measures)
    const original = content(grid)

    const barrages = sumsTo(grid.length, grid.length > 16 ? [-4, -5, -7] : [-1, -2, -3])
    expect(barrages.length).toBeGreaterThan(10)

    for (const steps of barrages) {
      expect(steps.reduce((a, b) => a + b, 0)).toBe(grid.length)
      expect(content(steps.reduce((g, step) => rotate(g, step), grid)), steps.join('+')).toBe(original)
    }
  })

  test('partial sums agree with one rotation by the running total', () => {
    const grid = redivide(parseSheet('c4 d8 e8 f2 | g4 r4 b2').measures)
    let running = grid
    let total = 0

    for (const step of [1, 2, 3, 4, 5, 6, 7, 8]) {
      running = rotate(running, step)
      total += step
      expect(content(running), `after ${total}`).toBe(content(rotate(grid, total)))
    }
  })
})

// Through notation it is not an identity: each wrap can cut one sounding, and nothing can
// tie backwards across the start of a line. What holds is the timing, and a bound on the
// damage — N rotations lose at most N ties.
describe('rotateSheet — near-identity, and the bound on what is lost', () => {
  const lines = [
    'c4 d4 e4 f4',
    'c8. d16 e4 f2',
    'c4~ c4 d2',
    'c16 d16 e8 f4 g2',
    'c2 d2 | e2 f2',
    'c4 d8 e8 f2 | g4 r4 b2',
  ]

  const sounding = (ms: SheetMeasure[]) =>
    redivide(ms).map(s => s.note ? `${s.note.note!.name}${s.note.note!.octave}` : 'r').join(' ')
  const attacks = (ms: SheetMeasure[]) => redivide(ms).filter(s => s.note && !s.tied).length

  test.each(lines)('timing survives any number of rotations: %s', src => {
    const base = parseSheet(src).measures
    const grid = redivide(base)
    let rotated = base

    for (let n = 1; n <= 2 * grid.length; n++) {
      rotated = rotateSheet(rotated, 1)
      expect(sounding(rotated), `after ${n}`).toBe(
        rotate(grid, n).map(s => s.note ? `${s.note.note!.name}${s.note.note!.octave}` : 'r').join(' '))
    }
  })

  test.each(lines)('N rotations add at most N attacks: %s', src => {
    const base = parseSheet(src).measures
    const before = attacks(base)
    let rotated = base

    for (let n = 1; n <= 2 * redivide(base).length; n++) {
      rotated = rotateSheet(rotated, 1)
      expect(attacks(rotated) - before, `after ${n}`).toBeLessThanOrEqual(n)
    }
  })

  test.each(lines)('bar lengths never move: %s', src => {
    const base = parseSheet(src).measures
    const lengths = base.map(m => m.reduce((a, n) => a + n.duration, 0))
    let rotated = base

    for (let n = 1; n <= redivide(base).length; n++) {
      rotated = rotateSheet(rotated, 1)
      expect(rotated.map(m => m.reduce((a, n) => a + n.duration, 0)), `after ${n}`).toStrictEqual(lengths)
    }
  })

  // Up to normalisation: `c4~ c4` and `c2` are the same sounding, and the rebuild picks
  // the canonical spelling, so the fixed point is reached after one turn and stays.
  test('one rotation by the whole length is the identity, spelling included', () => {
    for (const src of lines) {
      const base = rotateSheet(parseSheet(src).measures, 0)
      const length = redivide(base).length

      expect(show(rotateSheet(base, length)), src).toBe(show(base))
      expect(show(rotateSheet(base, -length)), src).toBe(show(base))
    }
  })
})
