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
