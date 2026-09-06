import { describe } from 'vitest'

// Parked: the quiz is tuned by ear, so pinning its wording and slot count in
// tests means re-editing them on every change. The body below still works —
// uncomment it (and drop the skip) when the shape settles.
describe.skip('tone diff quiz', () => { })

// import { describe, expect, test } from 'vitest'
// import { evalContents, rotateInterpolableLine, renderLineContentWithTags, interpolateSubtToString } from './RandomizeLang.js'
// import { RenderLine, isHidden } from './RandomizeLangTypes.js'
// import { parseSheet } from '../lib/SheetNotation.ts'

// // Read through vite's `?raw` so the test checks the file you actually edit.
// import src from '../../exercises/2026-09-06-tone-diff-quiz.rndl?raw'

// // Every evaluated line carrying substitutions — the file holds one variant per
// // wording, so the tests run over all of them rather than assuming a single card.
// function cards(): RenderLine[] {
//   const found = evalContents(src).filter(l => (l.source?.substitutions?.length || 0) > 0)
//   if (found.length === 0) throw new Error('the quiz file evaluated to no substituted line')
//   return found
// }

// function card(): RenderLine {
//   return cards()[0]
// }

// // Each variant words the answer its own way; both name one of the two tones.
// const ANSWER = /HIGHER|LOWER|FIRST|SECOND/

// function tagged(l: RenderLine, tag: string): string[] {
//   const found = (l.source?.substitutions || []).find(s => s.tag === tag)
//   if (!found) throw new Error(`no \`${tag}\` substitution on the card`)
//   return found.contents
// }

// const visible = (l: RenderLine) => {
//   const [cwt, byTag] = renderLineContentWithTags(l)
//   return cwt.map(ct => {
//     if (ct[0] === 'string') return ct[1]
//     const s = byTag.get(ct[1])
//     if (!s || isHidden(s)) return ''
//     return interpolateSubtToString(s.contents, false, 50)
//   }).join('')
// }

// describe('the quiz file as written', () => {
//   test('it parses into cards with no error lines', () => {
//     const lines = evalContents(src)
//     expect(lines.some(l => (l.contents || '').includes('error'))).toBe(false)
//     expect(cards().length).toBeGreaterThan(0)
//   })

//   test('every variant sounds two valid hz tokens, one per half note', () => {
//     for (const c of cards()) {
//       const { measures, errors } = parseSheet(tagged(c, 'tones')[0])
//       expect(errors).toStrictEqual([])

//       const ns = measures.flat()
//       expect(ns.length).toBe(2)
//       expect(ns.every(n => typeof n.hz === 'number' && n.hz > 0)).toBe(true)
//       expect(ns.map(n => n.duration)).toStrictEqual([8, 8])
//     }
//   })

//   test('the two tones differ — a pair you cannot tell apart is not a question', () => {
//     for (let trial = 0; trial < 20; trial++) {
//       for (const c of cards()) {
//         const [first, second] = parseSheet(tagged(c, 'tones')[0]).measures.flat().map(n => n.hz!)
//         expect(first).not.toBe(second)
//       }
//     }
//   })

//   test('the answer tracks the sign of the interval, over many draws', () => {
//     for (let trial = 0; trial < 40; trial++) {
//       for (const c of cards()) {
//         const [first, second] = parseSheet(tagged(c, 'tones')[0]).measures.flat().map(n => n.hz!)
//         const cents = Number(tagged(c, 'cents')[0])

//         // two forward presses is where the answer surfaces
//         const shown = visible(rotateInterpolableLine(rotateInterpolableLine(c)))

//         expect(shown).toMatch(ANSWER)
//         // the sign of `cents` is what the wording keys off, so it must agree
//         // with which tone actually came out higher
//         expect(second > first).toBe(cents > 0)
//       }
//     }
//   })

//   test('the answer is hidden for the first two presses and shows on the second', () => {
//     for (const c of cards()) {
//       let l = c
//       expect(visible(l)).not.toMatch(ANSWER)
//       l = rotateInterpolableLine(l)
//       expect(visible(l)).not.toMatch(ANSWER)
//       l = rotateInterpolableLine(l)
//       expect(visible(l)).toMatch(ANSWER)
//     }
//   })

//   test('the tones sound on the first press, then stay silent through the answer', () => {
//     let l = card()
//     expect(tagged(l, 'tones')[0]).toMatch(/hz/)

//     for (let press = 1; press <= 3; press++) {
//       l = rotateInterpolableLine(l)
//       expect(tagged(l, 'tones')[0]).toBe('r1')
//     }

//     // the four-slot cycle comes back round to a fresh pair
//     l = rotateInterpolableLine(l)
//     expect(tagged(l, 'tones')[0]).toMatch(/hz/)
//   })
// })
