// @vitest-environment jsdom
//
// The serialized MusicXML being right proves only half of it: OSMD silently ignores
// a <notehead> it doesn't handle, engraving an ordinary oval and saying nothing. So
// this drives the real engraver and reads the glyph back off the SVG it produced.
import { describe, expect, test } from 'vitest'
import { OpenSheetMusicDisplay as OSMD } from 'opensheetmusicdisplay'
import { parseSheet } from './SheetNotation'
import { notesToMusic, sheetToNotes } from './MusicXML'

// OSMD measures text and its sky/bottom lines through a 2d canvas context, which
// jsdom does not implement. Only the measurements have to be plausible — the glyph
// geometry under test is SVG, drawn by VexFlow without touching any of this.
//
// A fresh object per call, not one shared stub: OSMD writes its own properties onto
// the context it gets back, and a frozen or reused one fails on the assignment.
function stubContext() {
  return {
    font: '',
    measureText: (t: string) => ({ width: t.length * 6 }),
    getImageData: (_x: number, _y: number, w: number, h: number) =>
      ({ data: new Uint8ClampedArray(Math.max(1, w * h) * 4), width: w, height: h }),
    ...Object.fromEntries([
      'fillText', 'save', 'restore', 'scale', 'translate', 'beginPath', 'closePath',
      'fill', 'stroke', 'moveTo', 'lineTo', 'arc', 'rect', 'clearRect', 'fillRect',
      'setTransform', 'bezierCurveTo', 'quadraticCurveTo', 'clip', 'putImageData', 'drawImage',
    ].map(k => [k, () => {}])),
  }
}

// The stub covers only what OSMD reaches for, so it is not a CanvasRenderingContext2D
// and cannot be typed as one; `unknown` says that plainly rather than asserting a
// compatibility that isn't there.
HTMLCanvasElement.prototype.getContext =
  stubContext as unknown as typeof HTMLCanvasElement.prototype.getContext

function engrave(source: string): string {
  const { measures } = parseSheet(source)
  return notesToMusic(sheetToNotes(measures))
}

async function draw(source: string): Promise<string> {
  const div = document.createElement('div')
  document.body.appendChild(div)

  const osmd = new OSMD(div, { autoResize: false, drawTitle: false, drawPartNames: false })
  await osmd.load(engrave(source))
  osmd.render()

  return div.innerHTML
}

// Noteheads are `<path>`, and a head's own path is the one starting with a moveto.
// Stems and beams are paths too, so a bare count would not be about noteheads at all.
function headPaths(svg: string): string[] {
  return (svg.match(/<path[^>]*\bd="([^"]*)"/g) ?? [])
    .map(p => (p.match(/d="([^"]*)"/) ?? [])[1])
    .filter(d => d?.startsWith('M'))
}

describe('rendered noteheads', () => {
  test('a crossed head is drawn as a different glyph than an oval', async () => {
    // The same four pitches, so anything that differs is the notehead and not layout.
    const plain = headPaths(await draw('a4 a4 b4 b4'))
    const crossed = headPaths(await draw('a4[x] a4[x] b4[x] b4[x]'))

    const changed = crossed.filter(d => !plain.includes(d))
    expect(changed.length).toBe(4)

    // The Bravura cross is a far more involved outline than the oval: asserting on
    // its complexity distinguishes the two without pinning exact coordinates, which
    // would break on any VexFlow release that nudges the font.
    const segments = (d: string) => (d.match(/[CL]/g) ?? []).length
    const unchanged = plain.filter(d => !crossed.includes(d))

    expect(Math.min(...changed.map(segments)))
      .toBeGreaterThan(Math.max(...unchanged.map(segments)))
  }, 60000)

  test('only the marked notes change — a shape does not leak across the bar', async () => {
    const plain = headPaths(await draw('a4 a4 b4 b4'))
    const one = headPaths(await draw('a4[x] a4 b4 b4'))

    expect(one.filter(d => !plain.includes(d)).length).toBe(1)
  }, 60000)

  test('a crossed head still engraves when it also carries a colour', async () => {
    // Shape and colour share one <notehead>; if either overwrote the other, the
    // glyph would fall back to the oval the uncoloured plain rendering already has.
    const plain = headPaths(await draw('a4 a4 b4 b4'))
    const crossed = headPaths(await draw('a4[x] a4[x] b4[x] b4[x]'))
    const both = headPaths(await draw('a4[x][G] a4[x][G] b4[x][G] b4[x][G]'))

    expect(both.filter(d => !plain.includes(d)).length).toBe(4)

    // and it is the same cross glyph: colour is an attribute on the notehead, so it
    // moves no geometry — every path of the coloured rendering is one the uncoloured
    // crossed rendering already drew.
    expect(both.filter(d => !crossed.includes(d))).toStrictEqual([])
  }, 60000)
})

// A tie is a curve, not a glyph: VexFlow draws it as its own <path>, so it shows up as
// a path the untied rendering does not have. Ties are the reason durations like five
// sixteenths can be written at all, so this is the test that the feature works end to
// end — parse, <tie>/<tied>, engraver.
describe('rendered ties', () => {
  // The tie curve is a filled outline with no moveto-led notehead shape, so it is not
  // in headPaths; comparing whole path sets is what catches it.
  const allPaths = (svg: string): string[] =>
    (svg.match(/<path[^>]*\bd="([^"]*)"/g) ?? []).map(p => (p.match(/d="([^"]*)"/) ?? [])[1])

  test('a tie draws a curve the untied rendering does not have', async () => {
    const untied = allPaths(await draw('c4 c4 d2'))
    const tied = allPaths(await draw('c4~ c4 d2'))

    expect(tied.length).toBeGreaterThan(untied.length)
  }, 60000)

  // headPaths() takes any moveto-led path, and the tie curve is one, so the tied
  // rendering has the untied heads plus exactly the curve — not a different set of heads.
  test('the noteheads are unchanged — a tie adds a curve, it does not restyle notes', async () => {
    const untied = headPaths(await draw('c4 c4 d2'))
    const tied = headPaths(await draw('c4~ c4 d2'))

    expect(untied.every(d => tied.includes(d))).toBe(true)

    // and what it added is a curve: quadratic segments, which no notehead glyph uses.
    const added = tied.filter(d => !untied.includes(d))
    expect(added.length).toBe(1)
    expect(added[0]).toMatch(/Q/)
  }, 60000)

  test('a tie carries across a bar line', async () => {
    const untied = allPaths(await draw('c2 c2 | c1'))
    const tied = allPaths(await draw('c2 c2~ | c1'))

    expect(tied.length).toBeGreaterThan(untied.length)
  }, 60000)
})
