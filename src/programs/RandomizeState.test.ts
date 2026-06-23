import { describe, expect, test } from 'vitest'
import { UserItem } from './RandomizeTypes.ts'
import { Decks, DEFAULT_DECK } from './GenericList.ts'
import {
  RState, RecalcDeps,
  reduceRecalc, reduceTimer, reduceSetBpm, reduceMetro,
  defaultBpm,
} from './RandomizeState.ts'

// Minimal UserItem builder — only the fields the reducers read.
function item(contents: string, extra: Partial<UserItem> = {}): UserItem {
  return { kind: 'renderline', contents, key: contents, separator: null, source: null, timer: undefined, ...extra }
}

const NOW = 1_000_000
const deps = (over: Partial<RecalcDeps> = {}): RecalcDeps => ({ hideDone: true, bpm: defaultBpm, now: NOW, ...over })

// A v5 state with a single "default" deck of the given items at cursor index.
function stateOf(contents: string[], current = 0, over: Partial<RState> = {}): RState {
  const items: Decks<UserItem> = { [DEFAULT_DECK]: contents.map(c => item(c)) }
  return { version: 5, items, current: [DEFAULT_DECK, current], ...over }
}

const labels = (s: RState) => (s.items?.[DEFAULT_DECK] || []).map(i => i.contents)
const at = (s: RState) => s.items?.[DEFAULT_DECK]?.[s.current?.[1] ?? -1]?.contents

describe('reduceRecalc — advance', () => {
  test('seek forward / backward moves the in-deck index, deck name preserved', () => {
    let s = stateOf(['a', 'b', 'c'])
    s = reduceRecalc(s, { advance: ['seek', 1] }, deps())
    expect(s.current).toStrictEqual([DEFAULT_DECK, 1])
    expect(at(s)).toBe('b')

    s = reduceRecalc(s, { advance: ['seek', 1] }, deps())
    expect(at(s)).toBe('c')

    s = reduceRecalc(s, { advance: ['seek', -1] }, deps())
    expect(at(s)).toBe('b')
  })

  test('set jumps to an index within the same deck', () => {
    let s = stateOf(['a', 'b', 'c', 'd'])
    s = reduceRecalc(s, { advance: ['set', 2] }, deps())
    expect(s.current).toStrictEqual([DEFAULT_DECK, 2])
    expect(at(s)).toBe('c')
  })

  test('set out of bounds clamps to the last item', () => {
    let s = stateOf(['a', 'b', 'c'])
    s = reduceRecalc(s, { advance: ['set', 99] }, deps())
    expect(at(s)).toBe('c')
  })

  test('seek past the end stays on the last visible item', () => {
    let s = stateOf(['a', 'b'], 1)
    s = reduceRecalc(s, { advance: ['seek', 1] }, deps())
    expect(at(s)).toBe('b')
  })
})

describe('reduceRecalc — item actions', () => {
  test('done + hideDone hides the item and seeks forward off it', () => {
    let s = stateOf(['a', 'b', 'c'])
    s = reduceRecalc(s, { item: { reviewed: true, done: true } }, deps())
    // 'a' is now done; cursor resolved off it onto 'b'
    expect(at(s)).toBe('b')
    expect(s.items?.[DEFAULT_DECK]?.[0].done).toBe(true)
  })

  test('done with hideDone off keeps the cursor where it is', () => {
    let s = stateOf(['a', 'b', 'c'])
    s = reduceRecalc(s, { item: { done: true }, hideDone: false }, deps({ hideDone: false }))
    expect(at(s)).toBe('a') // not hidden, no seek
    expect(s.items?.[DEFAULT_DECK]?.[0].done).toBe(true)
  })

  test('bury drops the current item three visible slots down (deck-local)', () => {
    let s = stateOf(['a', 'b', 'c', 'd', 'e', 'f'])
    s = reduceRecalc(s, { item: { bury: true } }, deps())
    expect(labels(s)).toStrictEqual(['b', 'c', 'd', 'a', 'e', 'f'])
    expect(s.current?.[0]).toBe(DEFAULT_DECK) // still the same deck
  })

  test('unreview (star) moves the current item to the front and follows it', () => {
    let s = stateOf(['a', 'b', 'c', 'd'], 2) // on 'c'
    s = reduceRecalc(s, { item: { unreview: true } }, deps())
    expect(labels(s)).toStrictEqual(['c', 'a', 'b', 'd'])
    expect(s.current).toStrictEqual([DEFAULT_DECK, 0])
  })

  test('records review time using the injected now, not the wall clock', () => {
    let s = stateOf(['a', 'b'])
    s = reduceRecalc(s, { item: { reviewed: true, done: true } }, deps({ now: 42 }))
    const memory: [string, any][] = JSON.parse(s.memory!)
    const cards = Object.fromEntries(memory).cards
    expect(cards['a'].reviewed).toBe(42) // deterministic, no Date.now()
  })
})

describe('reduceRecalc — eval & deck wiring', () => {
  test('eval wraps the typed (unshuffled) text into the default deck and resets the cursor', () => {
    let s: RState = { version: 5 }
    s = reduceRecalc(s, { eval: true, contents: '-=-\nalpha\nbravo\ncharlie' }, deps())
    expect(labels(s)).toStrictEqual(['alpha', 'bravo', 'charlie'])
    expect(s.current).toStrictEqual([DEFAULT_DECK, 0])
    expect(s.outLineCount).toBe(3)
  })

  test('reads text/execute/hideDone from the passed state, not a stale closure', () => {
    // s carries text; recalc with no contents must fall back to s.text (the
    // staleness bug the extraction fixes: it used to read the render closure).
    const s: RState = { version: 5, text: '-=-\nx\ny', execute: true, hideDone: false }
    const out = reduceRecalc(s, { eval: true }, deps({ hideDone: false }))
    expect(labels(out)).toStrictEqual(['x', 'y'])
    expect(out.execute).toBe(true)
    expect(out.hideDone).toBe(false)
  })

  test('empty / undefined state is handled without throwing', () => {
    const out = reduceRecalc(undefined, { advance: ['seek', 1] }, deps())
    expect(out.items?.[DEFAULT_DECK]).toStrictEqual([])
    expect(out.current).toStrictEqual([DEFAULT_DECK, 0])
  })
})

describe('reduceTimer', () => {
  test('start sets the current item local timer running and leaves siblings stopped', () => {
    let s = stateOf(['a', 'b', 'c'], 1)
    s = reduceTimer(s, 'start', null, NOW)
    const items = s.items![DEFAULT_DECK]
    expect(items[1].timer?.running).toBe(true)
    expect(items[0].timer?.running).toBe(false)
    expect(items[2].timer?.running).toBe(false)
  })

  test('only the cursor’s deck is touched; other decks are left intact', () => {
    const s: RState = {
      version: 5,
      current: [DEFAULT_DECK, 0],
      items: { [DEFAULT_DECK]: [item('a')], other: [item('z')] },
    }
    const out = reduceTimer(s, 'start', null, NOW)
    expect(out.items!.other).toBe(s.items!.other) // untouched reference
    expect(out.items![DEFAULT_DECK][0].timer?.running).toBe(true)
  })

  test('undefined state returns the default state, no throw', () => {
    expect(reduceTimer(undefined, 'start', null, NOW).version).toBe(5)
  })
})

describe('reduceSetBpm / reduceMetro', () => {
  test('setBpm stamps the current card’s bpm into memory', () => {
    const s = stateOf(['a', 'b'])
    const out = reduceSetBpm(s, 123)
    const cards = Object.fromEntries(JSON.parse(out.memory!)).cards
    expect(cards['a'].bpm).toBe(123)
  })

  test('metro diff clamps bpm and re-stamps the current card (no nested setState)', () => {
    const s = stateOf(['a'])
    const out = reduceMetro(s, { bpm: 9999 }) // above the 500 clamp
    expect(out.metro?.bpm).toBe(500)
    const cards = Object.fromEntries(JSON.parse(out.memory!)).cards
    expect(cards['a'].bpm).toBe(500)
  })
})
