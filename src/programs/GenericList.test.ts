import { expect, test } from 'vitest'
import { Direction } from './LinearSeek.ts'
import {
  dropThree,
  bottomOfQueue,
  freshState,
  seek,
  setCurrent,
  toTop,
  visible,
  Exclude,
  ListState,
} from './GenericList.ts'

const { Forward, Backward } = Direction

// The model is opaque over A; exclusion is the caller's concern. These tests use
// a string item that carries its own done/skip flags and an exclude predicate
// that hides done/skipped items (mirroring how Randomize wires it up).
type Word = { value: string, done?: boolean, skip?: boolean, dropped?: number }
const words = (s: string): Word[] => s.split(' ').map(value => ({ value }))

let hideDone = true
const exclude: Exclude<Word> = w => hideDone && (w.done === true || w.skip === true)

const labels = (state: ListState<Word>) => state.items.map(i => i.value)
const at = (state: ListState<Word>) => state.items[state.current]?.value
const doneSet = (state: ListState<Word>) => state.items.filter(i => i.done).map(i => i.value)
const visibleValues = (state: ListState<Word>) => visible(state, exclude).map(([i]) => i.value)

// mark the current item done in-place, then resolve the cursor off it (what
// Randomize's setDone-then-seek does)
const complete = (state: ListState<Word>): ListState<Word> => {
  const items = state.items.map((i, ix) => ix === state.current ? { ...i, done: true } : i)
  return seek({ ...state, items }, Direction.Zero, exclude)
}

function withHideDone<T>(value: boolean, f: () => T): T {
  const prev = hideDone
  hideDone = value
  try { return f() } finally { hideDone = prev }
}

test('freshState keeps items, cursor at 0', () => {
  const s = freshState(words('a b c'))
  expect(labels(s)).toStrictEqual(['a', 'b', 'c'])
  expect(s.current).toBe(0)
  expect(at(s)).toBe('a')
})

test('seek forward/backward steps over the list', () => {
  let s = freshState(words('a b c'))
  s = seek(s, Forward, exclude)
  expect(at(s)).toBe('b')
  s = seek(s, Forward, exclude)
  expect(at(s)).toBe('c')
  s = seek(s, Backward, exclude)
  expect(at(s)).toBe('b')
})

test('completing the current item seeks forward off it when it becomes hidden', () => {
  let s = freshState(words('a b c'))
  s = complete(s) // mark 'a' done
  expect(doneSet(s)).toStrictEqual(['a'])
  expect(at(s)).toBe('b') // seeked off the now-hidden 'a'
  expect(visibleValues(s)).toStrictEqual(['b', 'c'])
})

test('done items are skipped while seeking', () => {
  let s = freshState(words('a b c d'))
  s = setCurrent(s, 1, exclude)
  s = complete(s) // 'b' done, seeks to 'c'
  expect(at(s)).toBe('c')
  s = setCurrent(s, 0, exclude) // back to 'a'
  s = seek(s, Forward, exclude) // skip hidden 'b' -> 'c'
  expect(at(s)).toBe('c')
})

test('skipped items are hidden and seeked over like done ones', () => {
  let s = freshState(words('a b c d'))
  s.items[1].skip = true // 'b' is a separator-like item
  expect(visibleValues(s)).toStrictEqual(['a', 'c', 'd'])
  s = seek(s, Forward, exclude) // 'a' -> skip 'b' -> 'c'
  expect(at(s)).toBe('c')
  // with hiding off, skipped items are visible again
  withHideDone(false, () => {
    expect(visible(s, exclude).map(([i]) => i.value)).toStrictEqual(['a', 'b', 'c', 'd'])
  })
})

test('exclude off (hideDone false) reveals done items and keeps them seekable', () => {
  let s = freshState(words('a b c'))
  s = complete(s) // 'a' done, now at 'b'
  withHideDone(false, () => {
    expect(visible(s, exclude).map(([i]) => i.value)).toStrictEqual(['a', 'b', 'c'])
    const back = setCurrent(s, 0, exclude)
    expect(at(back)).toBe('a') // can land on done item when revealed
  })
})

test('dropThree buries the current item three slots down', () => {
  let s = freshState(words('a b c d e f'))
  s = dropThree(s, exclude) // move 'a' to index 3
  expect(labels(s)).toStrictEqual(['b', 'c', 'd', 'a', 'e', 'f'])
  expect(s.current).toBe(0) // cursor stays, now on 'b'
  expect(at(s)).toBe('b')
})

test('dropThree clamps to the end of a short list', () => {
  let s = freshState(words('a b c'))
  s = dropThree(s, exclude) // target clamps to last index
  expect(labels(s)).toStrictEqual(['b', 'c', 'a'])
})

test('dropThree counts visible items, dropping past two visible ones', () => {
  // 'b' and 'c' are done/hidden, so they should not count toward the drop.
  let s = freshState(words('a b c d e f'))
  s.items[1].done = true
  s.items[2].done = true
  expect(visibleValues(s)).toStrictEqual(['a', 'd', 'e', 'f'])

  s = dropThree(s, exclude)
  // 'a' must land below two visible items ('d', 'e') — fourth in the visible order,
  // NOT just below the single visible 'd' that a raw current+3 would have produced.
  expect(visibleValues(s)).toStrictEqual(['d', 'e', 'f', 'a'])
  expect(labels(s)).toStrictEqual(['b', 'c', 'd', 'e', 'f', 'a'])
})

test('dropThree is not a no-op when nothing visible is ahead', () => {
  let s = freshState(words('a b c'))
  s.items[1].done = true
  s.items[2].done = true // 'a' is the last visible item
  s = dropThree(s, exclude)
  expect(labels(s)).toStrictEqual(['b', 'c', 'a']) // unmoved
})

test('drop to last', () => {
  let s = freshState(words('a b c d e f'))
  // window.x = true // dead debug flag, nothing reads it

  s = dropThree(s, _ => true)
  expect(labels(s)).toStrictEqual(['b', 'c', 'd', 'e', 'f', 'a'])
  // window.x = false
})

// An item dropped more than once sinks to the bottom of the queue — below every
// item still trailing its dropped count — instead of only three slots down.
const droppedOf = (w: Word) => w.dropped || 0
const dropped = (state: ListState<Word>, counts: Record<string, number>): ListState<Word> => ({
  ...state,
  items: state.items.map(i => counts[i.value] === undefined ? i : { ...i, dropped: counts[i.value] }),
})
const buryWith = (state: ListState<Word>, count: number, excludeForBury: Exclude<Word> = exclude) =>
  dropThree(state, excludeForBury, exclude, bottomOfQueue(state, count, droppedOf, exclude))

test('bottomOfQueue is 0 on a first drop, so nothing competes yet', () => {
  const s = dropped(freshState(words('a b c d e')), { a: 1 })
  expect(bottomOfQueue(s, 1, droppedOf, exclude)).toBe(0)
  expect(labels(buryWith(s, 1))).toStrictEqual(['b', 'c', 'd', 'a', 'e'])
})

test('bottomOfQueue is the last visible index still held by a trailing item', () => {
  const s = dropped(freshState(words('a b c d e f')), { a: 3, d: 1 })
  // b(0) c(0) d(1) e(0) all trail a(3) by more than one; f(0) does too, and
  // reduce takes the max — index 5.
  expect(bottomOfQueue(s, 3, droppedOf, exclude)).toBe(5)
})

test('a repeatedly-dropped item lands at the bottom of the queue', () => {
  const s = dropped(freshState(words('a b c d e f')), { a: 3, d: 1, f: 2 })
  // f(2) is only one behind a(3), so it does not trail — the queue ends at e (index 4).
  expect(bottomOfQueue(s, 3, droppedOf, exclude)).toBe(4)
  expect(labels(buryWith(s, 3))).toStrictEqual(['b', 'c', 'd', 'e', 'a', 'f'])
})

test('the queue bottom only ever pushes further down, never pulls back up', () => {
  const s = dropped(freshState(words('a b c d e f')), { a: 2, b: 0, c: 1, d: 1, e: 1, f: 1 })
  // only b(0) trails a(2) by more than one -> bottom 1, but three-down still wins.
  expect(bottomOfQueue(s, 2, droppedOf, exclude)).toBe(1)
  expect(labels(buryWith(s, 2))).toStrictEqual(['b', 'c', 'd', 'a', 'e', 'f'])
})

test('the queue bottom skips hidden items', () => {
  let s = dropped(freshState(words('a b c d e f')), { a: 3 })
  s.items[4].done = true
  s.items[5].done = true // e and f are hidden, so the queue ends at d (index 3)
  expect(bottomOfQueue(s, 3, droppedOf, exclude)).toBe(3)
  expect(labels(buryWith(s, 3))).toStrictEqual(['b', 'c', 'd', 'a', 'e', 'f'])
})

test('queue bottom and excludeForBury combine: whichever lands the item lower wins', () => {
  const s = dropped(freshState(words('a b c d e f')), { a: 3, b: 1, c: 1 })
  // excludeForBury (Randomize's rule) skips items trailing by 2+: b(1) and c(1)
  // are skipped when counting three, pushing the three-down target to the end.
  const excludeForBury: Exclude<Word> = it => exclude(it) || (droppedOf(it) + 2 <= 3)
  expect(bottomOfQueue(s, 3, droppedOf, exclude)).toBe(5)
  expect(labels(buryWith(s, 3, excludeForBury))).toStrictEqual(['b', 'c', 'd', 'e', 'f', 'a'])
})

test('toTop moves the current item to the front and follows it', () => {
  let s = freshState(words('a b c d'))
  s = setCurrent(s, 2, exclude) // on 'c'
  s = toTop(s)
  expect(labels(s)).toStrictEqual(['c', 'a', 'b', 'd'])
  expect(s.current).toBe(0)
  expect(at(s)).toBe('c')
})

test('empty list is a no-op for every action', () => {
  const empty = freshState<Word>([])
  expect(at(seek(empty, Forward, exclude))).toBeUndefined()
  expect(at(dropThree(empty, exclude))).toBeUndefined()
  expect(at(toTop(empty))).toBeUndefined()
  expect(visible(empty, exclude)).toStrictEqual([])
})

test('full flow: bury, complete, star on a string list', () => {
  let s = freshState(words('warmup scales etude piece sightread'))

  // bury the warmup down three
  s = dropThree(s, exclude)
  expect(labels(s)).toStrictEqual(['scales', 'etude', 'piece', 'warmup', 'sightread'])
  expect(at(s)).toBe('scales')

  // complete scales -> seeks to etude
  s = complete(s)
  expect(at(s)).toBe('etude')
  expect(doneSet(s)).toStrictEqual(['scales'])

  // star the piece to the top
  s = setCurrent(s, 2, exclude) // 'piece'
  expect(at(s)).toBe('piece')
  s = toTop(s)
  expect(labels(s)).toStrictEqual(['piece', 'scales', 'etude', 'warmup', 'sightread'])
  expect(at(s)).toBe('piece')

  // revealing done shows scales again
  withHideDone(false, () => {
    expect(visible(s, exclude).map(([i]) => i.value)).toContain('scales')
  })
})
