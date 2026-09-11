import { describe, expect, test } from 'vitest'
import { parseSheet, resolveColor, stringColors } from './SheetNotation.ts'
import { note, rest, notesToMusic } from './MusicXML.tsx'

// The parser producing a colour proves nothing on its own: the colour has to survive
// into the serialized MusicXML, and the schema drops a malformed one without a word.
function engrave(source: string): string {
  const { measures } = parseSheet(source)
  return notesToMusic(measures.map(m => m.map(n =>
    n.note ? note(n.note, n.duration, { bowing: n.bowing, color: n.color }) : rest(n.duration))))
}

// The <notehead> elements themselves, so an assertion can't pass off the back of
// some unrelated corner of the document.
function noteheads(source: string): string[] {
  return engrave(source).match(/<notehead[^>]*>[^<]*<\/notehead>/g) ?? []
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
