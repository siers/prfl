import { describe, expect, test } from 'vitest'
import { UserItem, toUserItem } from './RandomizeTypes.ts'
import { evalContents } from './RandomizeLang.js'
import { Decks, DEFAULT_DECK } from './Decks.ts'
import { SpawnMode } from './RandomizeDecks.ts'
import type { Timer } from './Timers.ts'
import * as ToneLib from '../lib/ToneLib.ts'
import {
  RState, RecalcDeps,
  reduceRecalc, reduceTimer, reduceSetBpm, reduceMetro, reduceMetroClick, reduceSpawn, reduceCleanSubdeck, reduceEnterDeck, reduceEnterSubdeck, hasSubdeck, liveSubdeckName, reducePopOne, reducePopTo, deckPath,
  defaultBpm, defaultState, Scheduler, itemMetroBpm, itemMetroTones, recalcMetro,
  migrateV5, resolveDecks, resolveAt, reduceRefresh, reduceNewText,
} from './RandomizeState.ts'

const keepOrder: Scheduler = items => items

function item(contents: string, extra: Partial<UserItem> = {}): UserItem {
  return { kind: 'renderline', contents, key: contents, separator: null, source: null, timer: undefined, ...extra }
}

const NOW = 1_000_000
const deps = (over: Partial<RecalcDeps> = {}): RecalcDeps => ({ hideDone: true, bpm: defaultBpm, now: NOW, ...over })

// Whole items split into pointers and lines, the way state keeps them.
function decked(decks: Decks<UserItem>): Pick<RState, 'items' | 'lines'> {
  const { items, lines } = migrateV5({ version: 5, items: decks })
  return { items, lines }
}

function stateOf(contents: string[], current = 0, over: Partial<RState> = {}): RState {
  return { version: 6, ...decked({ [DEFAULT_DECK]: contents.map(c => item(c)) }), current: [DEFAULT_DECK, current], ...over }
}

const labels = (s: RState) => (resolveDecks(s)[DEFAULT_DECK] || []).map(i => i.contents)
const at = (s: RState) => resolveDecks(s)[DEFAULT_DECK]?.[s.current?.[1] ?? -1]?.contents

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
    expect(at(s)).toBe('b')
    expect(resolveDecks(s)[DEFAULT_DECK]?.[0].done).toBe(true)
  })

  test('done with hideDone off keeps the cursor where it is', () => {
    let s = stateOf(['a', 'b', 'c'])
    s = reduceRecalc(s, { item: { done: true }, hideDone: false }, deps({ hideDone: false }))
    expect(at(s)).toBe('a') // not hidden, no seek
    expect(resolveDecks(s)[DEFAULT_DECK]?.[0].done).toBe(true)
  })

  test('last moves the current item to the end, cursor on what followed', () => {
    let s = stateOf(['a', 'b', 'c'])
    s = reduceRecalc(s, { item: { last: true } }, deps())
    expect(labels(s)).toStrictEqual(['b', 'c', 'a'])
    expect(at(s)).toBe('b')
    expect(resolveDecks(s)[DEFAULT_DECK]?.[2].done).toBeFalsy() // still open, just last
  })

  test('bury drops the current item three visible slots down (deck-local)', () => {
    let s = stateOf(['a', 'b', 'c', 'd', 'e', 'f'])
    s = reduceRecalc(s, { item: { bury: true } }, deps())
    expect(labels(s)).toStrictEqual(['b', 'c', 'd', 'a', 'e', 'f'])
    expect(s.current?.[0]).toBe(DEFAULT_DECK) // still the same deck
  })

  test('bury skips done items when counting three, and clamps to the end if fewer remain', () => {
    // three items, the second is done (so hidden), cursor on the first, then bury it.
    let s = stateOf(['a', 'b', 'c'], 0, decked({ [DEFAULT_DECK]: [item('a'), item('b', { done: true }), item('c')] }))
    s = reduceRecalc(s, { item: { bury: true } }, deps())
    expect(labels(s)).toStrictEqual(['b', 'c', 'a']) // 'b' (done) is not counted; only 'c' remains, so 'a' clamps to the end
    expect(s.current).toStrictEqual([DEFAULT_DECK, 1]) // reorder keeps the in-deck index; the render layer skips 'b' when showing
  })

  test('bury marks the item dropped, and a first drop never competes with fresher items', () => {
    let s = stateOf(['a', 'b', 'c', 'd', 'e', 'f'])
    s = reduceRecalc(s, { item: { bury: true } }, deps())
    expect(labels(s)).toStrictEqual(['b', 'c', 'd', 'a', 'e', 'f'])
    expect(resolveDecks(s)[DEFAULT_DECK]?.find(i => i.contents == 'a')?.dropped).toBe(1)

    // 'b' is on its own first drop too, so it also just goes three down.
    s = reduceRecalc(s, { item: { bury: true } }, deps())
    expect(labels(s)).toStrictEqual(['c', 'd', 'a', 'b', 'e', 'f'])
    expect(resolveDecks(s)[DEFAULT_DECK]?.find(i => i.contents == 'b')?.dropped).toBe(1)
  })

  test('a second drop sends the item below every task still waiting its first turn', () => {
    let s = stateOf(['a', 'b', 'c', 'd', 'e', 'f'])
    // four burys: a, b, c, d each get dropped once and rotate to the front again.
    for (let n = 0; n < 4; n++) s = reduceRecalc(s, { item: { bury: true } }, deps())
    expect(labels(s)).toStrictEqual(['a', 'b', 'c', 'd', 'e', 'f'])

    // 'a' is now on its second drop, and 'e'/'f' have never been dropped — so 'a'
    // goes to the bottom of the queue rather than three slots down.
    s = reduceRecalc(s, { item: { bury: true } }, deps())
    expect(labels(s)).toStrictEqual(['b', 'c', 'd', 'e', 'f', 'a'])
    expect(resolveDecks(s)[DEFAULT_DECK]?.find(i => i.contents == 'a')?.dropped).toBe(2)
  })

  test('unreview (star) moves the current item to the front, follows it, and clears dropped', () => {
    let s = stateOf(['a', 'b', 'c', 'd'], 2) // on 'c'
    s = reduceRecalc(s, { item: { bury: true } }, deps({ hideDone: false }))
    s = reduceRecalc(s, { advance: ['set', labels(s).indexOf('c')] }, deps({ hideDone: false }))
    s = reduceRecalc(s, { item: { unreview: true } }, deps())
    expect(resolveDecks(s)[DEFAULT_DECK]?.[0].dropped).toBeFalsy()
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

describe('reduceRecalc — ban', () => {
  const cardsOf = (s: RState) => Object.fromEntries(JSON.parse(s.memory!)).cards

  test('ban marks done without recording a review', () => {
    let s = stateOf(['a', 'b'])
    s = reduceRecalc(s, { item: { done: true, ban: true } }, deps())
    expect(at(s)).toBe('b')
    expect(cardsOf(s)['a']).toStrictEqual(expect.objectContaining({ banned: true }))
    expect(cardsOf(s)['a'].reviewed).toBeUndefined()
  })

  test('a banned item starts out done after a re-eval and a refresh', () => {
    let s = reduceRecalc({ version: 6 }, { eval: true, contents: '-=-\nalpha\nbravo' }, deps())
    s = reduceRecalc(s, { item: { done: true, ban: true } }, deps())

    const evald = reduceRecalc(s, { eval: true }, deps())
    expect(resolveDecks(evald)[DEFAULT_DECK]?.map(i => [i.contents, !!i.done])).toStrictEqual([['alpha', true], ['bravo', false]])
    expect(at(evald)).toBe('bravo')

    const onAlpha = reduceRecalc({ ...s, hideDone: false }, { advance: ['set', 0] }, deps())
    const surfaced = reduceRecalc(onAlpha, { item: { done: false, ban: false } }, deps())
    const refreshed = reduceRefresh({ ...surfaced, items: { [DEFAULT_DECK]: [] } }, '-=-\nalpha\nbravo', NOW)
    expect(resolveDecks(refreshed)[DEFAULT_DECK]?.map(i => !!i.done)).toStrictEqual([false, false])
    expect(cardsOf(surfaced)['alpha'].banned).toBeUndefined()
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

  test('eval drops every spawned deck and resets the breadcrumb stack', () => {
    let s = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    expect(s.cursorStack).toStrictEqual([[DEFAULT_DECK, 0]])
    expect(Object.keys(s.items!)).toContain('Scale/zip')

    s = reduceRecalc(s, { eval: true, contents: '-=-\none\ntwo' }, deps()) // -=- keeps order
    expect(Object.keys(s.items!)).toStrictEqual([DEFAULT_DECK])
    expect(labels(s)).toStrictEqual(['one', 'two'])
    expect(s.current).toStrictEqual([DEFAULT_DECK, 0])
    expect(s.cursorStack).toStrictEqual([])
  })

  test('reads text/execute/hideDone from the passed state, not a stale closure', () => {
    const s: RState = { version: 5, text: '-=-\nx\ny', execute: true, hideDone: false }
    const out = reduceRecalc(s, { eval: true }, deps({ hideDone: false }))
    expect(labels(out)).toStrictEqual(['x', 'y'])
    expect(out.execute).toBe(true)
    expect(out.hideDone).toBe(false)
  })

  test('empty / undefined state is handled without throwing', () => {
    const out = reduceRecalc(undefined, { advance: ['seek', 1] }, deps())
    expect(resolveDecks(out)[DEFAULT_DECK]).toStrictEqual([])
    expect(out.current).toStrictEqual([DEFAULT_DECK, 0])
  })
})

describe('block subdecks — an item keyed like a named block', () => {
  const text = '-=-\nalpha\nscales: warm up first\n-=- scales\nMAJ\nMIN'
  const evaluated = () => reduceRecalc({ version: 5 }, { eval: true, contents: text }, deps())
  const onScales = () => reduceRecalc(evaluated(), { advance: ['set', 1] }, deps())
  const scalesItem = (s: RState) => resolveDecks(s)[DEFAULT_DECK][1]

  test('eval instantiates nothing: the root deck alone, no block decks', () => {
    const s = evaluated()

    expect(labels(s)).toStrictEqual(['alpha', 'scales: warm up first'])
    expect(Object.keys(s.items!)).toStrictEqual([DEFAULT_DECK])
  })

  test('the keyed item has a subdeck to enter, an unrelated one does not', () => {
    const s = evaluated()

    expect(hasSubdeck(s, scalesItem(s))).toBe(true)
    expect(liveSubdeckName(s, scalesItem(s))).toBeNull() // not instantiated yet
    expect(hasSubdeck(s, resolveDecks(s)[DEFAULT_DECK][0])).toBe(false)
  })

  test('entering instantiates the block as a deck and descends into it', () => {
    let s = onScales()
    s = reduceEnterSubdeck(s, scalesItem(s), NOW)

    expect(s.current).toStrictEqual(['scales/', 0])
    expect(resolveDecks(s)['scales/'].map(i => i.contents).sort()).toStrictEqual(['MAJ', 'MIN'])
    expect(deckPath(s)).toStrictEqual([DEFAULT_DECK, 'scales/'])

    s = reducePopOne(s, NOW)
    expect(s.current).toStrictEqual([DEFAULT_DECK, 1])
    expect(liveSubdeckName(s, scalesItem(s))).toBe('scales/')
  })

  test('re-entering a live deck keeps it as-is', () => {
    let s = onScales()
    s = reduceEnterSubdeck(s, scalesItem(s), NOW)
    s = reduceRecalc(s, { item: { done: true } }, deps())
    const deck = resolveDecks(s)['scales/']
    s = reducePopOne(s, NOW)

    s = reduceEnterSubdeck(s, scalesItem(s), NOW)
    expect(resolveDecks(s)['scales/']).toStrictEqual(deck)
  })

  test('an exhausted deck is instantiated fresh on enter', () => {
    let s = onScales()
    s = reduceEnterSubdeck(s, scalesItem(s), NOW)
    s = reduceRecalc(s, { item: { done: true } }, deps())
    s = reduceRecalc(s, { item: { done: true } }, deps())
    s = reducePopOne(s, NOW)
    expect(liveSubdeckName(s, scalesItem(s))).toBeNull()

    s = reduceEnterSubdeck(s, scalesItem(s), NOW)
    expect(s.current![0]).toBe('scales/')
    expect(resolveDecks(s)['scales/'].every(i => !i.done)).toBe(true)
  })

  test('an item without a block or deck enters nothing', () => {
    const s = evaluated()
    expect(reduceEnterSubdeck(s, resolveDecks(s)[DEFAULT_DECK][0], NOW)).toBe(s)
  })

  test('a header names its block by its evaluated key, kept from the eval', () => {
    let s = reduceRecalc({ version: 5 }, { eval: true, contents: '-=-\nscales\n-=- sc{[\'ales\']}: warm up first\nMAJ' }, deps())
    expect(s.blockHeaders?.map(h => h?.key ?? null)).toStrictEqual([null, 'scales'])

    s = reduceEnterSubdeck(s, resolveDecks(s)[DEFAULT_DECK][0], NOW)
    expect(resolveDecks(s)['scales/'].map(i => i.contents)).toStrictEqual(['MAJ'])
  })

  test('an empty block enters nothing', () => {
    const s = reduceRecalc({ version: 5 }, { eval: true, contents: '-=-\nempty\n-=- empty' }, deps())
    expect(reduceEnterSubdeck(s, resolveDecks(s)[DEFAULT_DECK][0], NOW)).toBe(s)
  })

  test('nested: an item inside a block deck instantiates its own block', () => {
    let s = reduceRecalc({ version: 5 }, { eval: true, contents: '-=-\nouter\n-=- outer\ninner\n-=- inner\nX' }, deps())
    s = reduceEnterSubdeck(s, resolveDecks(s)[DEFAULT_DECK][0], NOW)
    s = reduceEnterSubdeck(s, resolveAt(s, s.current!)!, NOW)

    expect(deckPath(s)).toStrictEqual([DEFAULT_DECK, 'outer/', 'inner/'])
    expect(resolveAt(s, s.current!)!.contents).toBe('X')
  })

  test('re-eval drops instantiated decks and clears the stack', () => {
    let s = onScales()
    s = reduceEnterSubdeck(s, scalesItem(s), NOW)

    s = reduceRecalc(s, { eval: true }, deps())
    expect(Object.keys(s.items!)).toStrictEqual([DEFAULT_DECK])
    expect(s.current).toStrictEqual([DEFAULT_DECK, 0])
    expect(s.cursorStack).toStrictEqual([])
  })

  test('cleaning from the keyed item drops its instantiated deck, same as a spawned one', () => {
    let s = onScales()
    s = reducePopOne(reduceEnterSubdeck(s, scalesItem(s), NOW), NOW)

    s = reduceCleanSubdeck(s, scalesItem(s))
    expect(Object.keys(s.items!)).toStrictEqual([DEFAULT_DECK])
    expect(hasSubdeck(s, scalesItem(s))).toBe(true) // still instantiable
  })
})

describe('reduceTimer', () => {
  test('start sets the current item local timer running and leaves siblings stopped', () => {
    let s = stateOf(['a', 'b', 'c'], 1)
    s = reduceTimer(s, 'start', null, NOW)
    const items = resolveDecks(s)[DEFAULT_DECK]
    expect(items[1].timer?.running).toBe(true)
    expect(items[0].timer?.running).toBe(false)
    expect(items[2].timer?.running).toBe(false)
  })

  test('only the cursor’s deck is touched; other decks are left intact', () => {
    const s: RState = {
      version: 5,
      current: [DEFAULT_DECK, 0],
      ...decked({ [DEFAULT_DECK]: [item('a')], other: [item('z')] }),
    }
    const out = reduceTimer(s, 'start', null, NOW)
    expect(out.items!.other).toBe(s.items!.other) // untouched reference
    expect(resolveDecks(out)[DEFAULT_DECK][0].timer?.running).toBe(true)
  })

  test('undefined state returns the default state, no throw', () => {
    expect(reduceTimer(undefined, 'start', null, NOW).version).toBe(6)
  })

  test('stop/start while nested propagates up the cursorStack chain, not just the leaf', () => {
    let s = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder) // descends, starts the leaf timer
    expect(s.cursorStack).toStrictEqual([[DEFAULT_DECK, 0]])
    expect(resolveDecks(s)[DEFAULT_DECK][0].timer?.running).toBe(true) // parent item still running

    s = reduceTimer(s, 'stop', null, NOW + 1000)
    expect(resolveDecks(s)['Scale/zip'][0].timer?.running).toBe(false) // leaf paused
    expect(resolveDecks(s)[DEFAULT_DECK][0].timer?.running).toBe(false) // ancestor paused too

    s = reduceTimer(s, 'start', null, NOW + 2000)
    expect(resolveDecks(s)['Scale/zip'][0].timer?.running).toBe(true)
    expect(resolveDecks(s)[DEFAULT_DECK][0].timer?.running).toBe(true) // ancestor resumed too
  })

  test('a local-only command does not touch ancestor timers', () => {
    let s = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    s = reduceTimer(s, 'restart', 'local', NOW + 1000)
    expect(resolveDecks(s)[DEFAULT_DECK][0].timer?.running).toBe(true) // untouched, still running
  })

  test('subtract-and-restart at the top level discounts totalTimer by the leaf item’s elapsed time', () => {
    let s = stateOf(['a', 'b'])
    s = { ...s, totalTimer: { kind: 'started', start: NOW - 5000, running: true } } // 5s elapsed so far
    s.items![DEFAULT_DECK][0].timer = { kind: 'started', start: NOW - 1000, running: true } // leaf ran for 1s
    s = reduceTimer(s, 'subtract-and-restart', null, NOW)
    expect(s.totalTimer).toStrictEqual({ kind: 'started', start: NOW - 4000, running: true })
  })

  test('subtract-and-restart while nested discounts totalTimer and the ancestor alike', () => {
    let s = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    s = { ...s, totalTimer: { kind: 'started', start: NOW - 5000, running: true } } // 5s elapsed so far
    s.items![DEFAULT_DECK][0].timer = { kind: 'started', start: NOW - 4000, running: true } // ancestor: 4s elapsed
    s.items!['Scale/zip'][0].timer = { kind: 'started', start: NOW - 1000, running: true } // leaf: 1s elapsed

    s = reduceTimer(s, 'subtract-and-restart', null, NOW)
    expect(s.totalTimer).toStrictEqual({ kind: 'started', start: NOW - 4000, running: true }) // 5s - 1s
    expect(resolveDecks(s)[DEFAULT_DECK][0].timer).toStrictEqual({ kind: 'started', start: NOW - 3000, running: true }) // 4s - 1s
    expect(resolveDecks(s)['Scale/zip'][0].timer).toStrictEqual({ kind: 'started', start: NOW, running: true }) // leaf restarted
  })

  test('subtract-and-restart two levels deep takes the same interval off every ancestor', () => {
    let s = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    s = { ...s, cursorStack: [...s.cursorStack!, ['Scale/zip', 0]], current: ['leaf', 0], ...decked({ ...resolveDecks(s), leaf: [item('x')] }) }
    s = { ...s, totalTimer: { kind: 'started', start: NOW - 5000, running: true } }
    s.items![DEFAULT_DECK][0].timer = { kind: 'started', start: NOW - 5000, running: true } // outer: 5s
    s.items!['Scale/zip'][0].timer = { kind: 'started', start: NOW - 3000, running: true } // inner: 3s
    s.items!.leaf[0].timer = { kind: 'started', start: NOW - 1000, running: true } // leaf: 1s

    s = reduceTimer(s, 'subtract-and-restart', null, NOW)
    expect(resolveDecks(s)[DEFAULT_DECK][0].timer).toStrictEqual({ kind: 'started', start: NOW - 4000, running: true }) // 5s - 1s, not compounded
    expect(resolveDecks(s)['Scale/zip'][0].timer).toStrictEqual({ kind: 'started', start: NOW - 2000, running: true }) // 3s - 1s
  })

  test('an ancestor shorter than the discounted interval clamps to zero rather than going negative', () => {
    let s = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    s = { ...s, totalTimer: { kind: 'started', start: NOW - 5000, running: true } }
    s.items![DEFAULT_DECK][0].timer = { kind: 'started', start: NOW - 400, running: true } // ancestor: only 0.4s
    s.items!['Scale/zip'][0].timer = { kind: 'started', start: NOW - 1000, running: true } // leaf: 1s

    s = reduceTimer(s, 'subtract-and-restart', null, NOW)
    expect(resolveDecks(s)[DEFAULT_DECK][0].timer).toStrictEqual({ kind: 'started', start: NOW, running: true }) // clamped to 0, still running
  })

  test('subtract-and-restart with totalTimer stopped subtracts up the chain and leaves it stopped', () => {
    let s = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    s = { ...s, totalTimer: { kind: 'stopped', length: 5000, running: false } }
    s.items![DEFAULT_DECK][0].timer = { kind: 'stopped', length: 4000, running: false } // ancestor: 4s
    s.items!['Scale/zip'][0].timer = { kind: 'stopped', length: 1000, running: false } // leaf: 1s

    s = reduceTimer(s, 'subtract-and-restart', null, NOW)
    expect(s.totalTimer).toStrictEqual({ kind: 'stopped', length: 4000, running: false })
    expect(resolveDecks(s)[DEFAULT_DECK][0].timer).toStrictEqual({ kind: 'stopped', length: 3000, running: false }) // subtracted, and still stopped
  })

  test('a refresh leaves totalTimer stopped at zero, not silently running', () => {
    let s = stateOf(['a', 'b'], 0, { totalTimer: { kind: 'started', start: NOW - 5000, running: true } })
    s = reduceRecalc(s, { eval: true, contents: 'alpha\nbravo' }, deps())
    expect(s.totalTimer).toStrictEqual({ kind: 'stopped', length: 0, running: false })
    expect(resolveAt(s, s.current!)?.timer?.running).toBe(false) // leaf agrees
  })

  test('subtract-and-restart two levels deep resyncs every ancestor to totalTimer', () => {
    let s = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    s = { ...s, cursorStack: [...s.cursorStack!, ['Scale/zip', 0]], current: ['leaf', 0], ...decked({ ...resolveDecks(s), leaf: [item('x')] }) }
    s = { ...s, totalTimer: { kind: 'stopped', length: 5000, running: false } } // totalTimer currently stopped
    s = reduceTimer(s, 'subtract-and-restart', null, NOW + 1000)
    expect(resolveDecks(s)[DEFAULT_DECK][0].timer?.running).toBe(false) // outer ancestor resynced to totalTimer (stopped)
    expect(resolveDecks(s)['Scale/zip'][0].timer?.running).toBe(false) // inner ancestor resynced too
  })
})

describe('reduceSetBpm / reduceMetro', () => {
  test('setBpm stamps the current card’s bpm into memory', () => {
    const s = stateOf(['a', 'b'])
    const out = reduceSetBpm(s, 123)
    const cards = Object.fromEntries(JSON.parse(out.memory!)).cards
    expect(cards['a'].bpm).toBe(123)
  })

  test('the panel defaults to open, and an explicit close survives later diffs', () => {
    expect(recalcMetro({}, {}).opened).toBe(true)
    expect(recalcMetro({ opened: false }, { bpm: 90 }).opened).toBe(false)
  })

  test('metro diff clamps bpm and re-stamps the current card (no nested setState)', () => {
    const s = stateOf(['a'])
    const out = reduceMetro(s, { bpm: 9999 }) // above the 500 clamp
    expect(out.metro?.bpm).toBe(500)
    const cards = Object.fromEntries(JSON.parse(out.memory!)).cards
    expect(cards['a'].bpm).toBe(500)
  })
})

describe('metro tag — an item authors its own tempo', () => {
  const tagged = (src: string): UserItem => toUserItem(evalContents(src)[0])

  function deckWith(items: UserItem[], over: Partial<RState> = {}): RState {
    return { version: 6, ...decked({ [DEFAULT_DECK]: items }), current: [DEFAULT_DECK, 0], ...over }
  }

  test('reads the bpm off a metro tag when landing on the item', () => {
    const s = deckWith([item('first'), tagged('Song: play [90]metro')])
    const out = reduceRecalc(s, { advance: ['seek', 1] }, deps())
    expect(out.metro?.bpm).toBe(90)
  })

  test('a multi-value metro tag uses the value rotated to the front', () => {
    const s = deckWith([item('first'), tagged("Song: [s('80,100')]metro")])
    const out = reduceRecalc(s, { advance: ['seek', 1] }, deps())
    expect(out.metro?.bpm).toBe(80)
  })

  test('tolerates surrounding text in the tag value', () => {
    const s = deckWith([item('first'), tagged("Song: [' 132 bpm ']metro")])
    const out = reduceRecalc(s, { advance: ['seek', 1] }, deps())
    expect(out.metro?.bpm).toBe(132)
  })

  test('the tag beats the bpm remembered for that card', () => {
    let s = deckWith([tagged('Song: play [90]metro'), item('other')])
    s = reduceSetBpm(s, 104)
    s = reduceRecalc(s, { advance: ['set', 1] }, deps())
    const out = reduceRecalc(s, { advance: ['set', 0] }, deps())
    expect(out.metro?.bpm).toBe(90)
  })

  test('an untagged item still restores its remembered bpm', () => {
    let s = deckWith([item('a'), item('b')])
    s = reduceSetBpm(s, 104)
    s = reduceRecalc(s, { advance: ['seek', 1] }, deps())
    const out = reduceRecalc(s, { advance: ['seek', -1] }, deps())
    expect(out.metro?.bpm).toBe(104)
  })

  test('an untagged, never-tuned item keeps the current tempo instead of resetting', () => {
    let s = deckWith([tagged('Song: play [90]metro'), item('plain')])
    s = reduceRecalc(s, { advance: ['set', 0] }, deps())
    expect(s.metro?.bpm).toBe(90)
    const out = reduceRecalc(s, { advance: ['seek', 1] }, deps())
    expect(out.metro?.bpm).toBe(90)
  })

  test('a non-numeric metro tag leaves the tempo alone', () => {
    let s = deckWith([item('first'), tagged("Song: [s('fast')]metro")])
    s = reduceMetro(s, { bpm: 104 })
    const out = reduceRecalc(s, { advance: ['seek', 1] }, deps())
    expect(out.metro?.bpm).toBe(104)
  })

  test('the tag bpm is clamped and stamped into the card’s memory', () => {
    const s = deckWith([item('first'), tagged('Song: play [9999]metro')])
    const out = reduceRecalc(s, { advance: ['seek', 1] }, deps())
    expect(out.metro?.bpm).toBe(500)
    const cards = Object.fromEntries(JSON.parse(out.memory!)).cards
    expect(cards['Song'].bpm).toBe(500)
  })

  test('a metro change rewrites the tag, so revisiting keeps the tuned bpm', () => {
    let s = deckWith([tagged('Song: play [90]metro'), item('other')])
    s = reduceMetro(s, { bpm: 104.7 })
    expect(itemMetroBpm(resolveAt(s, [DEFAULT_DECK, 0]))).toBe(104)
    expect(resolveAt(s, [DEFAULT_DECK, 0])?.contents).toBe(tagged('Song: play [104]metro').contents)
    s = reduceRecalc(s, { advance: ['set', 1] }, deps())
    const out = reduceRecalc(s, { advance: ['set', 0] }, deps())
    expect(out.metro?.bpm).toBe(104)
  })

  test('a metro change overwrites only the front value of a multi-value tag', () => {
    const s = reduceMetro(deckWith([tagged("Song: [s('80,100')]metro")]), { bpm: 70 })
    const subst = resolveAt(s, [DEFAULT_DECK, 0])?.source?.substitutions?.find(x => x.tag === 'metro')
    expect(subst?.contents).toStrictEqual(['70', '100'])
  })

  test('a metro change re-derives computed fields that read the tag', () => {
    const s = reduceMetro(deckWith([tagged('Song: [90]metro [String(Number(fields.metro.at(0)) * 2)]double:computed')]), { bpm: 60 })
    expect(resolveAt(s, [DEFAULT_DECK, 0])?.contents).toBe(tagged('Song: [60]metro [120]double').contents)
  })

  test('a metro change leaves a non-numeric tag alone', () => {
    const before = tagged("Song: [s('fast')]metro")
    const s = reduceMetro(deckWith([before]), { bpm: 104 })
    expect(resolveAt(s, [DEFAULT_DECK, 0])).toEqual(before) // the line is untouched; only the undefined timer differs
  })

  test('itemMetroBpm reads the tag directly, and is null without one', () => {
    expect(itemMetroBpm(tagged('Song: play [90]metro'))).toBe(90)
    expect(itemMetroBpm(tagged('Song: play [90]tempo'))).toBeNull()
    expect(itemMetroBpm(item('plain'))).toBeNull()
    expect(itemMetroBpm(undefined)).toBeNull()
  })
})

function stateWithSpawnable(): RState {
  const parent = toUserItem(evalContents("Scale: play [s('C,D')]key [s('up,down')]bow")[0])
  return { version: 6, ...decked({ [DEFAULT_DECK]: [parent, item('after')] }), current: [DEFAULT_DECK, 0] }
}

describe('reduceSpawn — descend into a spawned deck', () => {
  test('cartesian spawn creates the deck, descends, and pushes the parent cursor', () => {
    const out = reduceSpawn(stateWithSpawnable(), 'cartesian', NOW, keepOrder)
    expect(resolveDecks(out)['Scale/cartesian']?.map(i => i.contents)).toStrictEqual([
      'Scale: play [C] [up]', 'Scale: play [C] [down]', 'Scale: play [D] [up]', 'Scale: play [D] [down]',
    ])
    expect(out.current).toStrictEqual(['Scale/cartesian', 0])
    expect(out.cursorStack).toStrictEqual([[DEFAULT_DECK, 0]]) // parent pushed
    expect(resolveDecks(out)[DEFAULT_DECK]?.length).toBe(2) // default deck untouched
  })

  test('zip spawn produces the position-aligned deck', () => {
    const out = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    expect(resolveDecks(out)['Scale/zip']?.map(i => i.contents)).toStrictEqual([
      'Scale: play [C] [up]', 'Scale: play [D] [down]',
    ])
  })

  test('spawning a non-spawnable item is a no-op', () => {
    const s = stateOf(['plain'])
    expect(reduceSpawn(s, 'zip', NOW, keepOrder)).toBe(s)
  })

  test('the injected scheduler decides child order', () => {
    const reversing: Scheduler = items => [...items].reverse()
    const out = reduceSpawn(stateWithSpawnable(), 'zip', NOW, reversing)
    expect(resolveDecks(out)['Scale/zip']?.map(i => i.contents)).toStrictEqual([
      'Scale: play [D] [down]', 'Scale: play [C] [up]',
    ])
  })

  test('the real schedule keeps every child (a permutation, none lost) ', () => {
    const out = reduceSpawn(stateWithSpawnable(), 'cartesian', NOW) // default = scheduleByMemory
    const got = (resolveDecks(out)['Scale/cartesian'] || []).map(i => i.contents).sort()
    expect(got).toStrictEqual([
      'Scale: play [C] [down]', 'Scale: play [C] [up]', 'Scale: play [D] [down]', 'Scale: play [D] [up]',
    ])
  })

  test('re-spawning an already-populated subdeck keeps it as-is (no regeneration)', () => {
    const deck = 'Scale/cartesian'
    let s = reduceSpawn(stateWithSpawnable(), 'cartesian', NOW, keepOrder)
    const original = resolveDecks(s)[deck].map(i => i.contents)

    s = reducePopOne(s, NOW)
    expect(s.current).toStrictEqual([DEFAULT_DECK, 0])

    const reversing: Scheduler = items => [...items].reverse()
    s = reduceSpawn(s, 'cartesian', NOW, reversing)

    expect(resolveDecks(s)[deck].map(i => i.contents)).toStrictEqual(original) // not reversed
    expect(s.current).toStrictEqual([deck, 0]) // still descends
    expect(s.cursorStack).toStrictEqual([[DEFAULT_DECK, 0]]) // parent re-pushed
  })

  test('cleaning an item drops its subdeck(s) without moving the cursor or stack', () => {
    const parentItem = resolveDecks(stateWithSpawnable())[DEFAULT_DECK][0]
    // spawn both a zip and a cartesian subdeck from the same item, then pop out
    let s = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    s = reducePopOne(s, NOW)
    s = reduceSpawn(s, 'cartesian', NOW, keepOrder)
    s = reducePopOne(s, NOW)
    expect(Object.keys(s.items!)).toEqual(expect.arrayContaining(['Scale/zip', 'Scale/cartesian']))

    s = reduceCleanSubdeck(s, parentItem)

    expect(Object.keys(s.items!)).toStrictEqual([DEFAULT_DECK]) // both subdecks gone
    expect(s.current).toStrictEqual([DEFAULT_DECK, 0]) // cursor untouched
    expect(s.cursorStack ?? []).toStrictEqual([]) // stack untouched
  })

  test('re-spawning after a clean rebuilds the subdeck fresh', () => {
    const parentItem = resolveDecks(stateWithSpawnable())[DEFAULT_DECK][0]
    let s = reduceSpawn(stateWithSpawnable(), 'cartesian', NOW, keepOrder)
    const original = resolveDecks(s)['Scale/cartesian'].map(i => i.contents)
    s = reducePopOne(s, NOW)

    s = reduceCleanSubdeck(s, parentItem)

    // With the deck gone, reduceSpawn no longer reuses — the scheduler runs afresh.
    const reversing: Scheduler = items => [...items].reverse()
    s = reduceSpawn(s, 'cartesian', NOW, reversing)
    expect(resolveDecks(s)['Scale/cartesian'].map(i => i.contents)).toStrictEqual([...original].reverse())
  })

  test('cleaning an item with no spawned subdeck leaves items unchanged', () => {
    const s = stateOf(['a', 'b'], 1)
    expect(reduceCleanSubdeck(s, resolveDecks(s)[DEFAULT_DECK][0]).items).toStrictEqual(s.items)
  })

  test('liveSubdeckName goes null again after cleaning the subdeck', () => {
    const parentItem = resolveDecks(stateWithSpawnable())[DEFAULT_DECK][0]
    let s = reduceSpawn(stateWithSpawnable(), 'cartesian', NOW, keepOrder)
    expect(liveSubdeckName(s, parentItem)).toBe('Scale/cartesian')

    s = reduceCleanSubdeck(s, parentItem)
    expect(liveSubdeckName(s, parentItem)).toBeNull()
  })

  test('liveSubdeckName reports the deck name so the UI can offer "enter" not creation choices', () => {
    const parentItem = resolveDecks(stateWithSpawnable())[DEFAULT_DECK][0]
    expect(liveSubdeckName(stateWithSpawnable(), parentItem)).toBeNull() // nothing spawned yet

    const zipped = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    expect(liveSubdeckName(zipped, parentItem)).toBe('Scale/zip')
  })

  test('liveSubdeckName is null once every item in the subdeck is done', () => {
    const deck = 'Scale/cartesian'
    const parentItem = resolveDecks(stateWithSpawnable())[DEFAULT_DECK][0]
    let s = reduceSpawn(stateWithSpawnable(), 'cartesian', NOW, keepOrder)
    expect(liveSubdeckName(s, parentItem)).toBe(deck)

    s = { ...s, items: { ...s.items, [deck]: s.items![deck].map(i => ({ ...i, done: true })) } }
    expect(liveSubdeckName(s, parentItem)).toBeNull()
  })

  test('entering a deck by name descends into it, mode-agnostic, without rebuilding', () => {
    const deck = 'Scale/cartesian'
    let s = reduceSpawn(stateWithSpawnable(), 'cartesian', NOW, keepOrder)
    const before = resolveDecks(s)[deck].map(i => i.contents)
    s = reducePopOne(s, NOW)
    expect(s.current).toStrictEqual([DEFAULT_DECK, 0])

    s = reduceEnterDeck(s, deck, NOW)

    expect(s.current).toStrictEqual([deck, 0]) // descended
    expect(s.cursorStack).toStrictEqual([[DEFAULT_DECK, 0]]) // parent pushed
    expect(resolveDecks(s)[deck].map(i => i.contents)).toStrictEqual(before) // untouched
  })

  test('entering a non-existent deck is a no-op', () => {
    const s = stateOf(['a', 'b'], 1)
    expect(reduceEnterDeck(s, 'nope', NOW)).toBe(s)
  })

  // spawn, pop out, finish the first `doneCount` children, then descend again
  type Descend = (s: RState, mode: SpawnMode) => RState
  function reentered(mode: SpawnMode, doneCount: number, descend: Descend): RState {
    const deck = `Scale/${mode}`
    let s = reducePopOne(reduceSpawn(stateWithSpawnable(), mode, NOW, keepOrder), NOW)
    s = { ...s, items: { ...s.items, [deck]: s.items![deck].map((i, n) => n < doneCount ? { ...i, done: true } : i) } }
    return descend(s, mode)
  }

  const byEnter: Descend = (s, mode) => reduceEnterDeck(s, `Scale/${mode}`, NOW)
  const bySpawn: Descend = (s, mode) => reduceSpawn(s, mode, NOW, keepOrder)

  test.each([
    ['entering', byEnter, 2, 2],
    ['re-spawning into', bySpawn, 3, 3],
  ] satisfies [string, Descend, number, number][])('%s a partly-done deck lands on the first live item', (_name, descend, doneCount, want) => {
    const s = reentered('cartesian', doneCount, descend) // 4 children
    expect(s.current).toStrictEqual(['Scale/cartesian', want])
    expect(resolveAt(s, s.current!)?.done).toBeFalsy()
  })

  test('entering an all-done deck stays at the top rather than running off the end', () => {
    expect(reentered('zip', 2, byEnter).current).toStrictEqual(['Scale/zip', 0])
  })

  test('spawning into an all-done subdeck regenerates it instead of reusing', () => {
    const deck = 'Scale/cartesian'
    let s = reduceSpawn(stateWithSpawnable(), 'cartesian', NOW, keepOrder)
    const original = resolveDecks(s)[deck].map(i => i.contents)
    s = reducePopOne(s, NOW)

    // exhaust the subdeck
    s = { ...s, items: { ...s.items, [deck]: s.items![deck].map(i => ({ ...i, done: true })) } }

    // a reordering scheduler proves regeneration (fresh, undone, reversed)
    const reversing: Scheduler = items => [...items].reverse()
    s = reduceSpawn(s, 'cartesian', NOW, reversing)
    expect(resolveDecks(s)[deck].map(i => i.contents)).toStrictEqual([...original].reverse())
    expect(resolveDecks(s)[deck].every(i => !i.done)).toBe(true)
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

describe('defaultState eval', () => {
  test('evaluting defaultState produces sane items and cursor', () => {
    const out = reduceRecalc(defaultState, { eval: true }, deps())
    const defaultItems = resolveDecks(out)[DEFAULT_DECK] ?? []
    expect(defaultItems.length).toBe(3)
    expect(defaultItems.map(i => i.contents).sort()).toStrictEqual(['Juggling: do it', 'Lullaby: play it', 'Squats: do it'])
    expect(out.current).toStrictEqual([DEFAULT_DECK, 0])
    expect(out.outLineCount).toBe(3)
    expect(out.version).toBe(6)
    expect(out.text).toBe(defaultState.text)
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

  test('popOne stops the timer of the item left behind in the subdeck', () => {
    let s = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    s = reduceTimer(s, 'start', null, NOW)
    expect(resolveDecks(s)['Scale/zip'][0].timer?.running).toBe(true)
    s = reducePopOne(s, NOW + 1000)
    expect(resolveDecks(s)['Scale/zip'][0].timer).toStrictEqual({ kind: 'stopped', length: 1000, running: false })
    expect(resolveDecks(s)[DEFAULT_DECK][0].timer?.running).toBe(true) // parent keeps running
  })

  test('popTo stops the timers of every level left behind', () => {
    let s = reduceSpawn(stateWithSpawnable(), 'cartesian', NOW, keepOrder)
    const running = (start: number) => ({ kind: 'started', start, running: true }) satisfies Timer
    s = {
      ...s,
      ...decked({ ...resolveDecks(s), mid: [item('m', { timer: running(NOW) })], leaf: [item('l', { timer: running(NOW) })] }),
      cursorStack: [[DEFAULT_DECK, 0], ['mid', 0]],
      current: ['leaf', 0],
    }
    s = reduceTimer(s, 'start', null, NOW)
    s = reducePopTo(s, 0, NOW + 1000)
    expect(s.items!.mid[0].timer?.running).toBe(false)
    expect(s.items!.leaf[0].timer?.running).toBe(false)
    expect(resolveDecks(s)[DEFAULT_DECK][0].timer?.running).toBe(true)
  })

  test('popOne at the top level is a no-op', () => {
    const s = stateOf(['a', 'b'], 1)
    expect(reducePopOne(s, NOW).current).toStrictEqual([DEFAULT_DECK, 1])
  })

  test('popTo a level trims the stack to that level and restores its cursor', () => {
    let s = reduceSpawn(stateWithSpawnable(), 'cartesian', NOW, keepOrder)
    s = { ...s, cursorStack: [[DEFAULT_DECK, 0], ['mid', 3]], current: ['leaf', 2] }
    const out = reducePopTo(s, 1, NOW) // level 1 = 'mid'
    expect(out.current).toStrictEqual(['mid', 3])
    expect(out.cursorStack).toStrictEqual([[DEFAULT_DECK, 0]])
  })

  test('popTo the last (current) level is a no-op', () => {
    const s = reduceSpawn(stateWithSpawnable(), 'zip', NOW, keepOrder)
    expect(reducePopTo(s, 1, NOW).current).toStrictEqual(['Scale/zip', 0])
  })
})

describe('tones tag — the pitches the metro sounds', () => {
  const tagged = (src: string): UserItem => toUserItem(evalContents(src)[0])
  const pitches = (i?: UserItem) => itemMetroTones(i).map(n => n.note && ToneLib.render(n.note))

  test('reads a tones tag, flattening measures', () => {
    const out = itemMetroTones(tagged('Song: [`c4 d4 | e8 f8`]tones:hide'))
    expect(out.map(n => ToneLib.render(n.note!))).toEqual(['C4', 'D4', 'E4', 'F4'])
    expect(out.map(n => n.duration)).toEqual([4, 4, 2, 2])
  })

  test('a plain sheet tag is engraved but not sounded', () => {
    expect(itemMetroTones(tagged('Song: [`g4 a4`]sheet:hide'))).toEqual([])
  })

  test('a sheet tag opts into being sounded with a tones modifier', () => {
    expect(pitches(tagged('Song: [`g4 a4`]sheet:hide:tones'))).toEqual(['G4', 'A4'])
  })

  test('a tones tag wins over a sounded sheet tag', () => {
    expect(pitches(tagged('Song: [`c4`]tones:hide [`g4 a4`]sheet:hide:tones'))).toEqual(['C4'])
  })

  test('rests come through as null notes, keeping their duration', () => {
    const out = itemMetroTones(tagged('Song: [`c4 r4 d2`]tones:hide'))
    expect(out.map(n => n.note && ToneLib.render(n.note))).toEqual(['C4', null, 'D4'])
    expect(out.map(n => n.duration)).toEqual([4, 4, 8])
  })

  test('accidentals and octave marks survive', () => {
    expect(pitches(tagged("Song: [`cis4 bes,4 a'4`]tones:hide"))).toEqual(['C#4', 'Bb3', 'A5'])
  })

  test('no tag, or an unrelated one, yields nothing', () => {
    expect(itemMetroTones(tagged('Song: play [90]metro'))).toEqual([])
    expect(itemMetroTones(item('plain'))).toEqual([])
    expect(itemMetroTones(undefined)).toEqual([])
  })
})


describe('reduceMetroClick — the `next` tag counting off the metronome', () => {
  // A card whose programme is written in the DSL, so the tag is parsed the way
  // it is in the editor rather than hand-built.
  const carded = (programme: string, over: Partial<RState> = {}): RState => ({
    version: 5,
    ...decked({ [DEFAULT_DECK]: evalContents(`Etude: [\'${programme}\'.split(\' \')]next`).map(toUserItem) }),
    current: [DEFAULT_DECK, 0],
    ...over,
  })

  const shown = (s: RState) => resolveAt(s, s.current!)?.contents

  test('a click spends into the head step and shows it on the card', () => {
    const [s, action] = reduceMetroClick(carded('4f 4r'))
    expect(shown(s)).toBe('Etude: [3:1f 4r]')
    expect(action).toBe(null)
  })

  test('the spec walk, click by click, ending in the fire and the rotation', () => {
    let s = carded('4f 4r')
    const trail: [string | undefined, string][] = []
    for (let i = 0; i < 4; i++) {
      const [next, action] = reduceMetroClick(s)
      s = next
      trail.push([shown(s), action || '-'])
    }
    expect(trail).toEqual([
      ['Etude: [3:1f 4r]', '-'],
      ['Etude: [2:2f 4r]', '-'],
      ['Etude: [1:3f 4r]', '-'],
      ['Etude: [4r 4f]', 'f'],
    ])
  })

  test('the countdown survives a round trip through the DSL text', () => {
    // Re-parsing what the card renders must resume where it left off, which is
    // what makes the spent clicks belong in the value rather than beside it.
    let s = carded('4f 4r')
    for (let i = 0; i < 2; i++) s = reduceMetroClick(s)[0]
    const resumed = carded('2:2f 4r')
    expect(shown(reduceMetroClick(s)[0])).toBe(shown(reduceMetroClick(resumed)[0]))
  })

  test('an item without the tag is left alone', () => {
    const s = stateOf(['plain'])
    expect(reduceMetroClick(s)).toEqual([s, null])
  })

  test('only the current item counts down', () => {
    // `-=-` keeps the two in the order written; the default block shuffles.
    const two: RState = {
      version: 5,
      ...decked({ [DEFAULT_DECK]: evalContents("-=-\nA: ['2f']next\nB: ['2f']next").map(toUserItem) }),
      current: [DEFAULT_DECK, 1],
    }
    const [s] = reduceMetroClick(two)
    expect((resolveDecks(s)[DEFAULT_DECK] || []).map(i => i.contents)).toEqual(['A: [2f]', 'B: [1:1f]'])
  })

  test('no state is no crash', () => {
    expect(reduceMetroClick(undefined)[1]).toBe(null)
  })
})

describe('pointers', () => {
  const evaluated = (text: string) => reduceRecalc({ version: 6, text }, { eval: true }, deps())

  test('decks hold only keys and progress; the line lives once under its key', () => {
    const s = evaluated("-=-\nFoo: do it\nBar: do that")
    expect(s.items![DEFAULT_DECK].map(r => r.key)).toStrictEqual(['Foo', 'Bar'])
    expect(s.items![DEFAULT_DECK].every(r => !('contents' in r))).toBe(true)
    expect(Object.keys(s.lines!)).toStrictEqual(['Foo', 'Bar'])
  })

  test('a re-roll refreshes the line, so every pointer to it shows the new roll', () => {
    let s = evaluated("-=-\n2x Foo: [s('abcdefghij')]")
    s = reduceRecalc(s, { item: { regenerate: 'next' } }, deps())
    const [a, b] = resolveDecks(s)[DEFAULT_DECK]
    expect(a.contents).toStrictEqual(b.contents)
    expect(a.contents).not.toStrictEqual(resolveDecks(evaluated("-=-\n2x Foo: [s('abcdefghij')]"))[DEFAULT_DECK][0].contents)
  })

  test('progress stays on the pointer, not the shared line', () => {
    let s = evaluated("-=-\n2x Foo: do it")
    s = reduceRecalc(s, { item: { done: true } }, deps())
    expect(s.items![DEFAULT_DECK].map(r => r.done)).toStrictEqual([true, undefined])
  })

  test('separators get a key too', () => {
    const s = evaluated("-=-\na\n-=-\nb")
    expect(resolveDecks(s)[DEFAULT_DECK].map(i => i.separator)).toStrictEqual([null, true, null])
    expect(s.items![DEFAULT_DECK].every(r => typeof r.key === 'string')).toBe(true)
  })

  test('cleaning a subdeck drops the lines nothing points at any more', () => {
    const s = stateOf(['a'], 0, decked({ [DEFAULT_DECK]: [item('a')], 'a/zip': [item('z')] }))
    expect(Object.keys(reduceCleanSubdeck(s, resolveDecks(s)[DEFAULT_DECK][0]).lines!)).toStrictEqual(['a'])
  })

  test('a version 5 state splits into pointers and lines, keeping progress', () => {
    const migrated = migrateV5({ version: 5, items: { [DEFAULT_DECK]: [item('a', { done: true }), item('b')] } })
    expect(migrated.version).toBe(6)
    expect(migrated.items![DEFAULT_DECK]).toStrictEqual([{ key: 'a', done: true }, { key: 'b' }])
    expect(resolveDecks(migrated)[DEFAULT_DECK].map(i => i.contents)).toStrictEqual(['a', 'b'])
  })
})

describe('reduceRefresh', () => {
  const evaluated = (text: string) => reduceRecalc({ version: 6, text }, { eval: true }, deps())
  const keys = (s: RState) => s.items![DEFAULT_DECK].map(r => r.key)

  test('progress carries over by key, in the new text order', () => {
    let s = evaluated("-=-\nA: a\nB: b\nC: c")
    s = reduceRecalc(s, { item: { done: true } }, deps()) // A done
    s = reduceRefresh(s, "-=-\nC: c\nNew: n\nA: a2", NOW)

    expect(keys(s)).toStrictEqual(['C', 'New', 'A'])
    expect(s.items![DEFAULT_DECK].map(r => r.done)).toStrictEqual([undefined, undefined, true])
    expect(resolveDecks(s)[DEFAULT_DECK][2].contents).toBe('A: a2') // the line is the new one
  })

  test('copies carry progress in order: the nth new copy takes the nth old one', () => {
    let s = evaluated("-=-\n2x Foo: do it")
    s = reduceRecalc(s, { item: { done: true } }, deps())
    s = reduceRefresh(s, "-=-\n3x Foo: do it", NOW)
    expect(s.items![DEFAULT_DECK].map(r => r.done)).toStrictEqual([true, undefined, undefined])
  })

  test('timers carry over, and so does the total timer', () => {
    let s = evaluated("-=-\nA: a\nB: b")
    s = reduceTimer(s, 'start', null, NOW)
    const timerA = s.items![DEFAULT_DECK][0].timer
    const total = s.totalTimer
    s = reduceRefresh(s, "-=-\nB: b\nA: a", NOW)

    expect(s.totalTimer).toStrictEqual(total)
    expect(s.items![DEFAULT_DECK][1].timer).toStrictEqual(timerA)
  })

  test('the cursor follows its item to its new place', () => {
    let s = evaluated("-=-\nA: a\nB: b\nC: c")
    s = reduceRecalc(s, { advance: ['set', 1] }, deps()) // on B
    s = reduceRefresh(s, "-=-\nC: c\nA: a\nB: b", NOW)
    expect(resolveAt(s, s.current)?.key).toBe('B')
  })

  test('subdecks and the stack survive, with the stacked root cursor following its item', () => {
    let s = stateOf(['Scale', 'other'], 0, decked({ [DEFAULT_DECK]: [item('Scale'), item('other')], 'Scale/zip': [item('z')] }))
    s = reduceEnterDeck(s, 'Scale/zip', NOW)
    s = reduceRefresh(s, "-=-\nother\nScale", NOW)

    expect(s.current).toStrictEqual(['Scale/zip', 0])
    expect(s.cursorStack).toStrictEqual([[DEFAULT_DECK, 1]])
    expect(resolveDecks(s)['Scale/zip'].map(i => i.contents)).toStrictEqual(['z'])
  })
})

describe('reduceNewText', () => {
  const evaluated = (text: string) => reduceRecalc({ version: 6, text }, { eval: true }, deps())
  const doneA = () => reduceRecalc(evaluated("-=-\nA: a\nB: b"), { item: { done: true } }, deps())

  test('within the first 10 seconds new text starts over', () => {
    const s = reduceNewText({ ...doneA(), totalTimer: { kind: 'started', start: NOW - 5000, running: true } }, "-=-\nA: a\nB: b2", deps())
    expect(s.items![DEFAULT_DECK].map(r => r.done)).toStrictEqual([undefined, undefined])
  })

  test('past 10 seconds new text keeps the progress', () => {
    const s = reduceNewText({ ...doneA(), totalTimer: { kind: 'started', start: NOW - 11000, running: true } }, "-=-\nA: a\nB: b2", deps())
    expect(s.items![DEFAULT_DECK].map(r => r.done)).toStrictEqual([true, undefined])
    expect(resolveDecks(s)[DEFAULT_DECK][1].contents).toBe('B: b2')
  })
})
