import { describe, expect, test } from 'vitest'
import { toneEvents } from './Synth.tsx'
import { parseSheet } from '../lib/SheetNotation.ts'

const notes = (src: string) => parseSheet(src).measures.flat()

describe('toneEvents — notation to Transport-scheduled pitches', () => {
  test('quarter notes land one beat apart', () => {
    const [events, total] = toneEvents(notes('c4 d4 e4 f4'))
    expect(events.map(e => [e.pitch, e.time, e.duration])).toEqual([
      ['C4', 0, 1], ['D4', 1, 1], ['E4', 2, 1], ['F4', 3, 1],
    ])
    expect(total).toBe(4)
  })

  test('mixed durations accumulate the way they are written', () => {
    const [events, total] = toneEvents(notes('c4 d4 e8 f8 | g2'))
    expect(events.map(e => [e.pitch, e.time, e.duration])).toEqual([
      ['C4', 0, 1], ['D4', 1, 1], ['E4', 2, 0.5], ['F4', 2.5, 0.5], ['G4', 3, 2],
    ])
    expect(total).toBe(5)
  })

  test('rests advance the clock without sounding', () => {
    const [events, total] = toneEvents(notes('c4 r4 d4'))
    expect(events.map(e => [e.pitch, e.time])).toEqual([['C4', 0], ['D4', 2]])
    expect(total).toBe(3)
  })

  test('a trailing rest still takes up its beats, so the loop keeps its length', () => {
    const [events, total] = toneEvents(notes('c4 r2.'))
    expect(events.map(e => e.pitch)).toEqual(['C4'])
    expect(total).toBe(4)
  })

  test('a dot lengthens the note it is on', () => {
    const [events] = toneEvents(notes('c4. d8'))
    expect(events.map(e => [e.time, e.duration])).toEqual([[0, 1.5], [1.5, 0.5]])
  })

  test('nothing to sound is an empty schedule of zero length', () => {
    expect(toneEvents([])).toEqual([[], 0])
  })
})

describe('toneEvents — absolute frequencies', () => {
  test('a hz token is scheduled as a raw frequency, not a note name', () => {
    const [events] = toneEvents(notes('<442hz>4 <440hz>4'))
    expect(events.map(e => [e.pitch, e.time, e.duration])).toEqual([
      [442, 0, 1], [440, 1, 1],
    ])
  })

  test('hz and named notes interleave on one timeline', () => {
    const [events, total] = toneEvents(notes('c4 <442hz>2 r4'))
    expect(events.map(e => [e.pitch, e.time])).toEqual([['C4', 0], [442, 1]])
    expect(total).toBe(4)
  })
})

// A tie is one sustained note written as several. The engraver draws a curve; the
// synth has to actually hold the pitch, so the continuation lengthens the event that
// is already sounding instead of pushing a second one that would re-attack it.
describe('toneEvents — ties', () => {
  test('two tied quarters sound as one half note', () => {
    const [events, total] = toneEvents(notes('c4~ c4'))
    expect(events.map(e => [e.pitch, e.time, e.duration])).toEqual([['C4', 0, 2]])
    expect(total).toBe(2)
  })

  test('a chain of ties accumulates into a single event', () => {
    // 4 + 2 + 1 sixteenths = seven, a duration no single symbol can spell.
    const [events] = toneEvents(notes('c4~ c8~ c16'))
    expect(events.map(e => [e.pitch, e.time, e.duration])).toEqual([['C4', 0, 1.75]])
  })

  test('a tie holds across a bar line', () => {
    const [events, total] = toneEvents(notes('c2 c2~ | c1'))
    expect(events.map(e => [e.pitch, e.time, e.duration])).toEqual([['C4', 0, 2], ['C4', 2, 6]])
    expect(total).toBe(8)
  })

  test('without the tie the same notes re-attack', () => {
    const [events] = toneEvents(notes('c4 c4'))
    expect(events.map(e => [e.pitch, e.time, e.duration])).toEqual([['C4', 0, 1], ['C4', 1, 1]])
  })

  test('a tie to a different pitch does not merge — that would be a slur', () => {
    const [events] = toneEvents(notes('c4~ d4'))
    expect(events.map(e => [e.pitch, e.time, e.duration])).toEqual([['C4', 0, 1], ['D4', 1, 1]])
  })

  test('the hold does not survive a rest', () => {
    const [events] = toneEvents(notes('c4~ r4 c4'))
    expect(events.map(e => [e.pitch, e.time, e.duration])).toEqual([['C4', 0, 1], ['C4', 2, 1]])
  })
})

// A slur is a bowing/phrasing mark. It changes nothing about when or how long a note
// sounds — that is exactly what separates it from a tie.
describe('toneEvents — slurs do not change the sound', () => {
  test('a slurred phrase sounds like the unslurred one', () => {
    expect(toneEvents(notes('c8( d8 e8 f8)'))).toEqual(toneEvents(notes('c8 d8 e8 f8')))
  })

  test('a slur does not merge repeated pitches the way a tie does', () => {
    const [slurred] = toneEvents(notes('c4( c4)'))
    const [tied] = toneEvents(notes('c4~ c4'))

    expect(slurred.map(e => e.duration)).toEqual([1, 1])
    expect(tied.map(e => e.duration)).toEqual([2])
  })
})
