import { describe, expect, test } from 'vitest'
import { UserItem, toUserItem } from './RandomizeTypes.ts'
import { evalContents } from './RandomizeLang.js'
import { Decks, DEFAULT_DECK } from './GenericList.ts'
import {
  RState, RecalcDeps,
  reduceRecalc, reduceTimer, reduceSetBpm, reduceMetro, reduceSpawn, reducePopOne, reducePopTo, deckPath,
  defaultBpm, Scheduler,
} from './RandomizeState.ts'

// Inject identity for the spawn scheduler so child order is deterministic
// (production sorts by schedule with a random early-bias — tested separately).
const keepOrder: Scheduler = items => items

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

// A default deck holding one real interpolable item (built via the evaluator)
// at the cursor, so spawning has genuine parameters to expand.
function stateWithSpawnable(): RState {
  const parent = toUserItem(evalContents("Scale: play [s('C,D')]key [s('up,down')]bow")[0])
  return { version: 5, items: { [DEFAULT_DECK]: [parent, item('after')] }, current: [DEFAULT_DECK, 0] }
}

describe('reduceSpawn — descend into a spawned deck', () => {
  test('cartesian spawn creates the deck, descends, and pushes the parent cursor', () => {
    const out = reduceSpawn(stateWithSpawnable(), 'cartesian', NOW, keepOrder)
    expect(out.items?.['Scale/cartesian']?.map(i => i.contents)).toStrictEqual([
      'Scale: play [C] [up]', 'Scale: play [C] [down]', 'Scale: play [D] [up]', 'Scale: play [D] [down]',
    ])
    expect(out.current).toStrictEqual(['Scale/cartesian', 0])
    expect(out.cursorStack).toStrictEqual([[DEFAULT_DECK, 0]]) // parent pushed
    expect(out.items?.[DEFAULT_DECK]?.length).toBe(2) // default deck untouched
  })

  test('zip spawn produces the position-aligned deck', () => {
    const out = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    expect(out.items?.['Scale/zip']?.map(i => i.contents)).toStrictEqual([
      'Scale: play [C] [up]', 'Scale: play [D] [down]',
    ])
  })

  test('spawning a non-spawnable item is a no-op', () => {
    const s = stateOf(['plain'])
    expect(reduceSpawn(s, 'zip', NOW, keepOrder)).toBe(s)
  })

  test('the injected scheduler decides child order', () => {
    // A scheduler that reverses proves reduceSpawn defers ordering to it.
    const reversing: Scheduler = items => [...items].reverse()
    const out = reduceSpawn(stateWithSpawnable(), 'zip', NOW, reversing)
    expect(out.items?.['Scale/zip']?.map(i => i.contents)).toStrictEqual([
      'Scale: play [D] [down]', 'Scale: play [C] [up]',
    ])
  })

  test('the real schedule keeps every child (a permutation, none lost) ', () => {
    // The schedule pick is random (early-bias), so we assert membership, not
    // order: the cartesian deck still has all 4 distinct combinations.
    const out = reduceSpawn(stateWithSpawnable(), 'cartesian', NOW) // default = scheduleByMemory
    const got = (out.items?.['Scale/cartesian'] || []).map(i => i.contents).sort()
    expect(got).toStrictEqual([
      'Scale: play [C] [down]', 'Scale: play [C] [up]', 'Scale: play [D] [down]', 'Scale: play [D] [up]',
    ])
  })
})

describe('reduceRecalc — finishing a spawned deck does NOT auto-leave it', () => {
  test('seeking off the end stays on the last item, keeping the stack', () => {
    let s = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder) // deck of 2
    s = reduceRecalc(s, { advance: ['seek', 1] }, deps()) // -> last item
    expect(s.current).toStrictEqual(['Scale/zip', 1])

    s = reduceRecalc(s, { advance: ['seek', 1] }, deps()) // past the end: clamp, no pop
    expect(s.current).toStrictEqual(['Scale/zip', 1]) // still on the last item
    expect(s.cursorStack).toStrictEqual([[DEFAULT_DECK, 0]]) // still in the deck
  })

  test('seeking forward mid-deck stays in the deck', () => {
    let s = reduceSpawn(stateWithSpawnable(), 'cartesian', NOW, keepOrder) // deck of 4
    s = reduceRecalc(s, { advance: ['seek', 1] }, deps())
    expect(s.current).toStrictEqual(['Scale/cartesian', 1])
    expect(s.cursorStack).toStrictEqual([[DEFAULT_DECK, 0]])
  })
})

describe('breadcrumb / pop navigation', () => {
  test('deckPath lists root-to-current deck names', () => {
    expect(deckPath(stateOf(['a']))).toStrictEqual([DEFAULT_DECK])
    const s = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    expect(deckPath(s)).toStrictEqual([DEFAULT_DECK, 'Scale/zip'])
  })

  test('popOne leaves the spawned deck and restores the parent cursor', () => {
    let s = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    s = reduceRecalc(s, { advance: ['seek', 1] }, deps()) // move within the deck
    s = reducePopOne(s, NOW)
    expect(s.current).toStrictEqual([DEFAULT_DECK, 0]) // back on the parent item
    expect(s.cursorStack).toStrictEqual([])
  })

  test('popOne at the top level is a no-op', () => {
    const s = stateOf(['a', 'b'], 1)
    expect(reducePopOne(s, NOW).current).toStrictEqual([DEFAULT_DECK, 1])
  })

  test('popTo a level trims the stack to that level and restores its cursor', () => {
    // Build two levels of nesting: default -> Scale/zip -> (spawn again).
    let s = reduceSpawn(stateWithSpawnable(), 'cartesian', NOW, keepOrder)
    // descend a second time from a child that's spawnable? children are leaves,
    // so simulate a two-deep stack directly to test popTo in isolation.
    s = { ...s, cursorStack: [[DEFAULT_DECK, 0], ['mid', 3]], current: ['leaf', 2] }
    const out = reducePopTo(s, 1, NOW) // level 1 = 'mid'
    expect(out.current).toStrictEqual(['mid', 3])
    expect(out.cursorStack).toStrictEqual([[DEFAULT_DECK, 0]])
  })

  test('popTo the last (current) level is a no-op', () => {
    const s = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    // path = [default, Scale/zip]; level 1 is current -> no pop
    expect(reducePopTo(s, 1, NOW).current).toStrictEqual(['Scale/zip', 0])
  })
})
