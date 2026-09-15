import { describe, expect, test } from 'vitest'
import { parseSheet, resolveColor, stringColors } from './SheetNotation.ts'
import { note, rest, notesToMusic } from './MusicXML.tsx'

// The parser producing a colour proves nothing on its own: the colour has to survive
// into the serialized MusicXML, and the schema drops a malformed one without a word.
function engrave(source: string): string {
  const { measures } = parseSheet(source)
  return notesToMusic(measures.map(m => m.map(n =>
    n.note
      ? note(n.note, n.duration, { bowing: n.bowing, color: n.color, notehead: n.shape, text: n.text })
      : rest(n.duration))))
}

// The <notehead> elements themselves, so an assertion can't pass off the back of
// some unrelated corner of the document.
function noteheads(source: string): string[] {
  return engrave(source).match(/<notehead[^>]*>[^<]*<\/notehead>/g) ?? []
}

// Whole <technical> blocks, not bare <fingering>: a fingering that landed in a second
// <technical> alongside the bowing would still match the narrower pattern, and MusicXML
// allows only one per <notations>. The serializer indents, so the block is collapsed
// onto one line — the assertions are about which elements nest, not about layout.
function technicals(source: string): string[] {
  return (engrave(source).match(/<technical>.*?<\/technical>/gs) ?? [])
    .map(t => t.replace(/>\s+</g, '><'))
}

describe('engraved colour', () => {
  test('a string colour reaches the notehead attribute', () => {
    expect(noteheads("g,4[G] e'4[E]")).toStrictEqual([
      `<notehead color="${resolveColor('G')[0]}">normal</notehead>`,
      `<notehead color="${resolveColor('E')[0]}">normal</notehead>`,
    ])
  })

  test('an uncoloured note gets no notehead element at all', () => {
    expect(noteheads('c4')).toStrictEqual([])
    // and a colour on one note does not leak onto its neighbours
    expect(noteheads('c4[G] d4 e4')).toStrictEqual([
      `<notehead color="${resolveColor('G')[0]}">normal</notehead>`,
    ])
  })

  test('a notehead is engraved as normal, not as the schema fallback', () => {
    // contents: null would serialize as <notehead>other</notehead>, a wrong glyph
    expect(noteheads('c4[red]')).toStrictEqual(['<notehead color="#FF0000">normal</notehead>'])
  })

  test('keywords are engraved as hex, since musicxml would drop the keyword', () => {
    // asserted on the element, not the document: `red` as a bare substring would
    // pass vacuously today and break on any unrelated element that happens to contain it
    expect(noteheads('c4[red]')).toStrictEqual(['<notehead color="#FF0000">normal</notehead>'])
    expect(noteheads('c4[red]')[0]).not.toContain('red<')
  })

  test('a palette colour is engraved, whatever case the palette is written in', () => {
    // MusicXML's colour pattern is uppercase-only and a failing attribute is dropped
    // in silence, so `[G]` must normalise the same way `[#b35009]` does
    const musicXmlColor = /^#[\dA-F]{6}([\dA-F][\dA-F])?$/

    Object.keys(stringColors).forEach(name => {
      const heads = noteheads(`c4[${name}]`)
      expect(heads.length, name).toBe(1)
      expect(heads[0], name).toMatch(/<notehead color="#[\dA-F]{6}">normal<\/notehead>/)
      expect(resolveColor(name)[0], name).toMatch(musicXmlColor)
    })
  })
})

describe('engraved notehead shape', () => {
  test('a crossed head reaches the notehead element as the glyph name', () => {
    expect(noteheads('c4[x]')).toStrictEqual(['<notehead>x</notehead>'])
  })

  test('an unshaped note keeps the ordinary oval — no notehead element at all', () => {
    expect(noteheads('c4')).toStrictEqual([])
    // and a shape on one note does not leak onto its neighbours
    expect(noteheads('c4[x] d4 e4')).toStrictEqual(['<notehead>x</notehead>'])
  })

  test('shape and colour engrave on the same notehead, not two', () => {
    // one <notehead> per note: a second would be dropped, losing whichever came last
    expect(noteheads('c4[x][G]')).toStrictEqual([
      `<notehead color="${resolveColor('G')[0]}">x</notehead>`,
    ])
    expect(noteheads('c4[G][x]')).toStrictEqual([
      `<notehead color="${resolveColor('G')[0]}">x</notehead>`,
    ])
  })

  test('shape composes with a fingering, which stays in its own technical', () => {
    expect(noteheads('c4[x](3)')).toStrictEqual(['<notehead>x</notehead>'])
    expect(technicals('c4[x](3)')).toStrictEqual(['<technical><fingering>3</fingering></technical>'])
  })

  test('a rejected shape engraves nothing rather than a wrong glyph', () => {
    // `[X]` is the colour slot, and no such colour exists — so no notehead, not a cross
    expect(noteheads('c4[X]')).toStrictEqual([])
  })
})

describe('engraved text', () => {
  test('text reaches a fingering element', () => {
    expect(technicals('c4(3)')).toStrictEqual(['<technical><fingering>3</fingering></technical>'])
  })

  test('an untexted note gets no technical at all', () => {
    expect(technicals('c4')).toStrictEqual([])
    expect(technicals('c4[G]')).toStrictEqual([])
  })

  test('bowing and fingering share one technical element', () => {
    // MusicXML permits a single <technical> per <notations>; a second would be dropped
    expect(technicals('c4v(2)')).toStrictEqual([
      '<technical><up-bow/><fingering>2</fingering></technical>',
    ])
  })

  test('text and colour engrave independently of each other', () => {
    expect(noteheads('c4[G](1)')).toStrictEqual([
      `<notehead color="${resolveColor('G')[0]}">normal</notehead>`,
    ])
    expect(technicals('c4[G](1)')).toStrictEqual(['<technical><fingering>1</fingering></technical>'])
  })

  test('non-numeric text survives verbatim', () => {
    expect(technicals('c4(IV)')).toStrictEqual(['<technical><fingering>IV</fingering></technical>'])
  })

  test('a rejected text engraves nothing rather than an empty fingering', () => {
    expect(technicals('c4()')).toStrictEqual([])
  })
})
