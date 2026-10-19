import { describe, expect, test } from 'vitest'
import { fsrsDue, fsrsWaiting } from './RandomizeFsrs'
import { evalContents, scheduleItems } from './RandomizeLang'
import { markStartsDone } from './RandomizeTypes'

const DAY = 24 * 60 * 60 * 1000
const T = Date.UTC(2026, 0, 1)
const review = (time: number, accepted = true) => ({ time, length: 60 * 1000, accepted })

describe('fsrs', () => {
  test('only opted-in cards have a due date', () => {
    expect(fsrsDue(undefined)).toBeNull()
    expect(fsrsDue({ reviewed: T, reviews: [review(T)] })).toBeNull()
  })

  test('an opted-in card without reviews is due at the opt-in', () => {
    expect(fsrsDue({ fsrs: T })).toBe(T)
  })

  test('an accepted review pushes the due date out further than an unaccepted one', () => {
    const accepted = fsrsDue({ fsrs: T, reviews: [review(T)] })!
    const unaccepted = fsrsDue({ fsrs: T, reviews: [review(T, false)] })!

    expect(accepted).toBeGreaterThanOrEqual(T + DAY)
    expect(unaccepted).toBeLessThan(accepted)
  })

  test('reviews before the opt-in are not counted', () => {
    const fresh = fsrsDue({ fsrs: T, reviews: [review(T)] })
    expect(fsrsDue({ fsrs: T, reviews: [review(T - 9 * DAY), review(T - 3 * DAY), review(T)] })).toBe(fresh)
  })

  test('a card not due yet starts out done', () => {
    const memory = new Map([['cards', { a: { fsrs: T, reviews: [review(T)] }, b: { fsrs: T } }]])

    expect(fsrsWaiting(memory.get('cards')!.a, T + 1)).toBe(true)
    expect(markStartsDone(memory, [{ key: 'a' }, { key: 'b' }, { key: 'c' }], T + 1).map(r => !!r.done))
      .toStrictEqual([true, false, false])
  })

  test('scheduling puts due FSRS cards first and waiting ones last', () => {
    const now = Date.now()
    const memory = new Map([['cards', {
      Waiting: { reviewed: now, fsrs: now, reviews: [review(now)] },
      Old: { reviewed: now - 9 * DAY },
      Due: { reviewed: now - 5 * DAY, fsrs: now - 5 * DAY },
    }]])
    const items = evalContents('-=-\nWaiting\nOld\nDue')

    expect(scheduleItems(items, memory).map(l => l.contents)).toStrictEqual(['Due', 'Old', 'Waiting'])
  })
})
