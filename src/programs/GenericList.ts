import { arrayMove } from '../lib/Array.ts'
import { Direction, linearSeekFullNext, linearSeekNext } from './LinearSeek.ts'

// A generic, framework-agnostic distillation of Randomize's todo-list model.
// No review/flashcard/timer/metro components — only:
//   * drop down three — "bury": move the current item past the next visible ones
//   * to top          — "star": move the current item to the front
//   * seeking         — linearSeek-based cursor that skips excluded items
//
// `A` is fully opaque. What counts as "excluded" (hidden + un-seekable) is the
// caller's business, passed in as a predicate per call — so done-ness, a
// hideDone toggle, separators, etc. all stay in the caller. Randomize passes
// `i => hideDone && (i.done || i.separator)`; the cursor/reorder mechanics here
// don't need to know what any of those mean.

export type ListState<A> = {
  items: A[],
  current: number,
}

export type Exclude<A> = (item: A) => boolean

export function freshState<A>(items: A[]): ListState<A> {
  return { items, current: 0 }
}

function clampIndex<A>(items: A[], index: number): number {
  if (items.length === 0) return 0
  return Math.max(0, Math.min(items.length - 1, index))
}

// Seek to the next non-excluded item in `direction` (+1 / -1). With Direction.Zero
// the cursor stays put unless it's sitting on an excluded item, in which case it
// resolves forward off it.
export function seek<A>(state: ListState<A>, direction: Direction, exclude: Exclude<A>): ListState<A> {
  if (state.items.length === 0) return state

  const mustSeek = exclude(state.items[state.current]) || direction !== 0
  if (!mustSeek) return state

  const visits = linearSeekFullNext(state.items, state.current, direction || 1, exclude)
  const next = visits.length > 0 ? visits[0] : state.current
  return { ...state, current: clampIndex(state.items, next) }
}

// Jump the cursor straight to `index`, then resolve away from it if it's excluded.
export function setCurrent<A>(state: ListState<A>, index: number, exclude: Exclude<A>): ListState<A> {
  const moved = { ...state, current: clampIndex(state.items, index) }
  return exclude(moved.items[moved.current]) ? seek(moved, Direction.Forward, exclude) : moved
}

// "drop down three" — bury the current item past the next three *visible* items
// (so it ends up below two of them and lands fourth in the visible order),
// clamped to the last visible slot. Counting visible items, not raw indices,
// means excluded items in between don't shorten the drop. Cursor stays on the
// same index, so it lands on whatever bubbled up into the current slot.
export function dropThree<A>(state: ListState<A>, exclude: Exclude<A>): ListState<A> {
  if (state.items.length === 0) return state

  const ahead = linearSeekNext(state.items, state.current, Direction.Forward, exclude)
  if (ahead.length === 0) return state // nothing visible ahead — already at the bottom

  const target = ahead[Math.min(2, ahead.length - 1)] // third visible ahead, or the last
  const items = arrayMove(state.items, state.current, target)
  const settled = { ...state, items }
  return exclude(settled.items[settled.current]) ? seek(settled, Direction.Forward, exclude) : settled
}

// "to top" — Randomize's star/unreview: move the current item to the front and
// put the cursor on it.
export function toTop<A>(state: ListState<A>): ListState<A> {
  if (state.items.length === 0) return state

  const items = arrayMove(state.items, state.current, 0)
  return { ...state, items, current: 0 }
}

// The items currently visible (non-excluded), paired with their real indices.
export function visible<A>(state: ListState<A>, exclude: Exclude<A>): [A, number][] {
  return state.items.flatMap((item, i) => exclude(item) ? [] : [[item, i] as [A, number]])
}
