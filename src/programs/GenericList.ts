import { arrayMove } from '../lib/Array.ts'
import { Direction, linearSeekFullNext, linearSeekNext, linearSeekPast } from './LinearSeek.ts'

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

export function dropThree<A>(state: ListState<A>, exclude: Exclude<A>): ListState<A> {
  if (state.items.length === 0) return state

  const ahead = linearSeekPast(state.items, state.current, Direction.Forward, exclude, 1, 1)
  const items = arrayMove(state.items, state.current, ahead[clampIndex(ahead, 2)])

  return { ...state, items }
}

export function toTop<A>(state: ListState<A>): ListState<A> {
  if (state.items.length === 0) return state

  const items = arrayMove(state.items, state.current, 0)
  return { ...state, items, current: 0 }
}

export function visible<A>(state: ListState<A>, exclude: Exclude<A>): [A, number][] {
  return state.items.flatMap((item, i) => exclude(item) ? [] : [[item, i] as [A, number]])
}
