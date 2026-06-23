// Pure state reducers for Randomize.
//
// These were closures inside the Randomize component; extracting them to module
// scope makes the state transitions pure and directly unit-testable, and — by
// construction — they can only read their `s` argument, never a stale render-
// time `state` closure (which the in-component recalc used to do).
//
// Time is injected as `now` so tests are deterministic without faking the
// clock. The cursor/deck mechanics live in GenericList; this module is the
// Randomize-specific glue: items + memory + timers + metro.

import { evalContentsMem, evalRenderLine, rotateInterpolableLine } from './RandomizeLang.js'
import { makeEmptyMemory } from './RandomizeLangTypes.js'
import { CardData, UserItem, cardSet, findCard, toUserItem } from './RandomizeTypes.js'
import { Timer, freshTimer, freshTimerOrRestart, toStartedTimer, toStoppedTimer, timerSubtract } from './Timers.ts'
import { mapParse, mapSerialize } from '../lib/Map.js'
import { clamp } from 'lodash'
import { Direction } from './LinearSeek.ts'
import { ListState, dropThree, toTop, Decks, DeckCursor, DEFAULT_DECK, cursorEq, decksOf, deckItems, deckGet, deckSeek, deckSetCurrent, Exclude } from './GenericList.ts'
import { SpawnMode, spawnChildren, spawnDeckName } from './RandomizeDecks.ts'

export const currentStateVersion = 5
export const defaultBpm = 60

export type DeckIndex = DeckCursor

export type Metro = {
  opened?: boolean,
  power?: boolean,
  bpm?: number,
  volume?: number,
}

export type RState = {
  version: 5,
  text?: string,

  items?: Decks<UserItem>,
  outLineCount?: number,
  memory?: string,
  nextMemory?: string,

  execute?: boolean,
  current?: DeckIndex,
  // Decks you descended into, parent-first. Spawning pushes the parent cursor;
  // exhausting/leaving a spawned deck pops back to it. Empty/undefined at the
  // top level. Additive over v5 — old states simply have no stack.
  cursorStack?: DeckCursor[],
  hideDone?: boolean,
  totalTimer?: Timer,

  metro?: Metro,
}

export const defaultState: RState = {
  version: 5,

  text: "Lullaby: play it\nJuggling: do it\nSquats: do it"
}

export type Seek = ['seek', number] | ['set', number] | []

export type Args = {
  eval?: boolean,
  contents?: string,
  save?: boolean,
  execute?: boolean,
  advance?: Seek,
  hideDone?: boolean,
  item?: ItemActions,
}

export type ItemActions = {
  reviewed?: boolean,
  done?: boolean,
  bury?: boolean,
  regenerate?: 'new' | 'next',
  regenerateKey?: string,
  unreview?: boolean,
}

export type TimerCommand = 'start' | 'stop' | 'restart' | 'local-as-global' | 'subtract-and-restart'
export type TimerAction = 'start' | 'stop' | 'restart' | ['subtract', Timer | null] | 'no-op'

// ── small helpers ──────────────────────────────────────────────────────────

function withMemory(mem: string | undefined, f: (memory: any) => void): string {
  const memory = mem ? mapParse(mem) : makeEmptyMemory()
  f(memory)
  return mapSerialize(memory)
}

function memoryFromString(mem?: string) {
  return (mem && mapParse(mem)) || makeEmptyMemory()
}

// done/separator items are skipped; "excluded" additionally honours hideDone.
export function itemSkipped(item?: UserItem): boolean {
  return item?.separator == true || item?.done == true
}

export function excludeFor(hideDone: boolean): Exclude<UserItem> {
  return item => hideDone !== false && itemSkipped(item)
}

export function setItemBpmMemory(key: string | null, m: string | undefined, bpm: number): string {
  return withMemory(m, memory => {
    if (key) cardSet(memory, key, { bpm: bpm })
  })
}

export function recalcMetro(old: Metro, diff: Metro): Metro {
  const diffFilt = Object.fromEntries(Object.entries(diff).filter(([_key, value]) => value != null && value != undefined))
  const fresh = { opened: false, power: false, bpm: defaultBpm, ...old, ...diffFilt }
  fresh.bpm = clamp(Math.floor(fresh.bpm), 20, 500)
  return fresh
}

// ── items ──────────────────────────────────────────────────────────────────

function itemsAndTimer(items: UserItem[], m: string | undefined, eval_: boolean, contents: string, total: Timer | undefined): [UserItem[], Timer | undefined] {
  if (!eval_) return [items, total]

  let memory: Map<any, any> = memoryFromString(m)
  const [lines, _] = evalContentsMem(contents, memory)
  return [lines.map(rl => toUserItem(rl)), undefined]
}

// Apply an item action to the deck-local flat list. `current` is the in-deck
// index. Returns the new list, new memory, and — for reorders (bury/unreview)
// that resolve the cursor themselves — the new in-deck index (else null).
export function modifyItemState(
  inItems: UserItem[] | undefined,
  m: string | undefined,
  current: number,
  currentMetro: number,
  controls: ItemActions,
  exclude: Exclude<UserItem>,
  now: number,
): [UserItem[], string, number | null] {
  const items = inItems || []

  const newMemory = withMemory(m, memory => {
    if (controls.reviewed === true && items[current].key)
      cardSet(memory, items[current].key, { reviewed: now, bpm: currentMetro })

    if (controls.unreview === true && items[current].key)
      cardSet(memory, items[current].key, { reviewed: 0, })
  })

  const updatedItems: UserItem[] = items.map((item, index) => {
    if (index != current) return item
    if (controls.regenerate === 'new') {
      if (!item.source) return item
      return evalRenderLine(item, memoryFromString(m)) satisfies UserItem
    } else if (controls.regenerate === 'next') {
      if (!item.source) return item
      return rotateInterpolableLine(item, controls.regenerateKey)
    } else return { ...item, done: controls.done === undefined ? item.done : controls.done } satisfies UserItem
  })

  // bury ("drop down three") and unreview ("to top") are GenericList reorders:
  // they move the item and resolve the cursor themselves, so recalc skips its
  // own seek for them (signalled by returning a non-null new current).
  const list: ListState<UserItem> = { items: updatedItems, current }
  const reordered: ListState<UserItem> | null =
    controls.bury === true ? dropThree(list, exclude)
      : controls.unreview === true ? toTop(list)
        : null

  return reordered
    ? [reordered.items, newMemory, reordered.current]
    : [updatedItems, newMemory, null]
}

// ── timers ───────────────────────────────────────────────────────────────────

function modifyTimerPure(tIn: Timer | undefined, command: TimerAction, now: number): Timer {
  const t: Timer = tIn || freshTimer(now)

  if (command == 'no-op') return t

  if (command == 'start' || command == 'restart') {
    return (!t || command == 'restart') ? freshTimerOrRestart(now, t) : toStartedTimer(t, now)
  }

  if (command == 'stop') {
    return toStoppedTimer(t, now)
  }

  if (command[0] == 'subtract') {
    return timerSubtract(t, command[1], now)
  }

  return freshTimer(0) // impossible
}

export function reduceTimer(s: RState | undefined, commandIn: TimerCommand, target: null | 'local' = null, now: number): RState {
  if (!s) return defaultState satisfies RState

  let commandGlobal: TimerAction | undefined
  let commandLocal: TimerAction

  if (commandIn == 'local-as-global') {
    commandLocal = s?.totalTimer?.kind == 'started' ? 'start' : 'stop'
    commandGlobal = 'no-op'
  } else if (commandIn == 'subtract-and-restart') {
    const currentItem = deckGet(s.items || {}, s.current || [DEFAULT_DECK, 0])
    commandGlobal = ['subtract', currentItem?.timer || null]
    commandLocal = 'restart'
  } else {
    if (target != 'local') commandGlobal = commandIn
    commandLocal = commandIn
  }

  // Timers live on items, so only the cursor's deck has a running timer; every
  // item in every other deck is implicitly stopped. We only touch that deck.
  const [curDeck, curIndex] = s?.current || [DEFAULT_DECK, 0]
  const decks = s.items || {}
  return {
    ...s,
    totalTimer: modifyTimerPure(s?.totalTimer || undefined, commandGlobal || 'no-op', now),
    items: {
      ...decks,
      [curDeck]: deckItems(decks, curDeck).map((item, index) => {
        return {
          ...item,
          timer: modifyTimerPure(item?.timer, index == curIndex ? commandLocal : 'stop', now),
        }
      }),
    },
  }
}

// ── bpm / metro ──────────────────────────────────────────────────────────────

export function reduceSetBpm(s: RState | undefined, bpm: number): RState {
  const key = (s && deckGet(s.items || {}, s.current || [DEFAULT_DECK, 0]))?.key
  return { ...s, memory: setItemBpmMemory(key ?? null, s?.memory, bpm) } as RState
}

// Apply a metro diff and re-stamp the current card's bpm in memory. Folds in
// what was previously a nested setState (metroState -> setItemBpm).
export function reduceMetro(s: RState | undefined, diff: Metro): RState {
  const metro = recalcMetro(s?.metro || {}, diff)
  const withMetro: RState = { version: currentStateVersion, ...s, metro }
  return reduceSetBpm(withMetro, metro.bpm || defaultBpm)
}

// ── recalc ─────────────────────────────────────────────────────────────────

export type RecalcDeps = {
  hideDone: boolean | undefined, // the render-time hideDone (a.hideDone may flip it)
  bpm: number,
  now: number,
}

// The core advance/item/eval reducer. Works deck-locally on the cursor's deck:
// pull that deck's flat list out, reorder/seek within it, fold it back in.
export function reduceRecalc(s: RState | undefined, a: Args, deps: RecalcDeps): RState {
  const contentsOr: string = a.contents === '' ? a.contents : (a.contents || s?.text || '')
  const execute = a.execute === undefined ? s?.execute : a.execute
  const hideDone = a.hideDone === undefined ? s?.hideDone : a.hideDone

  const prevCursor: DeckCursor = s?.current || [DEFAULT_DECK, 0]
  const deck = prevCursor[0]
  const prevDeckItems = deckItems(s?.items || decksOf<UserItem>([]), deck)

  let [initItems, totalTimer] = itemsAndTimer(prevDeckItems, s?.memory, !!a?.eval, contentsOr, s?.totalTimer)

  // Exclusion is built from the locally-resolved hideDone (which a.hideDone may
  // be flipping in this very update), not a stale closure.
  const excludeSeek = excludeFor(hideDone !== false)
  const [deckList, memory, reorderedCurrent] = modifyItemState(initItems, s?.memory, prevCursor[1], deps.bpm, a.item || {}, excludeSeek, deps.now)
  const memoryMap = mapParse(memory)

  // The cursor is resolved by GenericList: a bury/unreview reorder already set
  // it; otherwise translate the advance request into a seek/set/stay.
  const decksAfterReorder: Decks<UserItem> = { ...(s?.items || {}), [deck]: deckList }
  const reorderedCursor: DeckCursor = [deck, reorderedCurrent !== null ? reorderedCurrent : prevCursor[1]]
  const seekDirection = a.advance?.at(0) === "seek" ? (a.advance[1]! as Direction) : null
  const [resolvedDecks, resolvedCursor]: [Decks<UserItem>, DeckCursor] =
    reorderedCurrent !== null
      ? [decksAfterReorder, reorderedCursor]
      : seekDirection !== null
        ? deckSeek(decksAfterReorder, reorderedCursor, seekDirection, excludeSeek)
        : a.advance?.at(0) === "set"
          ? deckSetCurrent(decksAfterReorder, reorderedCursor, a.advance![1]! satisfies number, excludeSeek)
          : deckSeek(decksAfterReorder, reorderedCursor, Direction.Zero, excludeSeek) // resolve off an excluded current

  // Exhaust → pop: a forward seek inside a spawned deck that couldn't advance
  // (stayed put at the end) returns to the parent item the spawn descended from.
  const stack = s?.cursorStack || []
  const exhausted = seekDirection !== null && seekDirection > 0 && stack.length > 0
    && cursorEq(resolvedCursor, reorderedCursor)
  const [poppedStack, poppedCursor]: [DeckCursor[], DeckCursor] =
    exhausted ? [stack.slice(0, -1), stack[stack.length - 1]] : [stack, resolvedCursor]

  const items = deckItems(resolvedDecks, deck)
  const nextCursor: DeckCursor = a.eval ? [deck, 0] : poppedCursor

  const newItem = deckGet(resolvedDecks, nextCursor)
  const newKey = newItem && newItem.key
  const newCard: CardData | null = newKey && findCard(memoryMap, newItem.key || '') || null
  const newBpm: number = (newCard && newCard.bpm ? newCard.bpm : undefined) || defaultBpm
  const metro: Metro = newKey ? recalcMetro(s?.metro || {}, { bpm: newBpm }) : (s?.metro || {})

  const newState = {
    version: currentStateVersion,

    ...s,
    text: contentsOr,

    items: resolvedDecks,
    outLineCount: items.length,
    memory: newKey ? setItemBpmMemory(newKey, memory, newBpm) : memory,

    execute: execute,
    current: nextCursor,
    cursorStack: poppedStack,
    hideDone: hideDone,
    totalTimer,

    metro,
  } satisfies RState

  return reduceTimer(newState, 'local-as-global', null, deps.now)
}

// Spawn a deck from the current item's parameters, descend into it, and push the
// current cursor onto the return stack so exhausting the spawned deck pops back.
export function reduceSpawn(s: RState | undefined, mode: SpawnMode, now: number): RState {
  if (!s) return defaultState satisfies RState

  const cursor: DeckCursor = s.current || [DEFAULT_DECK, 0]
  const parent = deckGet(s.items || {}, cursor)
  if (!parent) return s

  const children = spawnChildren(parent, mode)
  if (children.length === 0) return s // nothing to expand

  const deckName = spawnDeckName(parent, mode)
  const items: Decks<UserItem> = { ...(s.items || {}), [deckName]: children }
  const newCursor: DeckCursor = [deckName, 0]

  const newState: RState = {
    ...s,
    version: currentStateVersion,
    items,
    current: newCursor,
    cursorStack: [...(s.cursorStack || []), cursor],
  }

  // Start the descended item's timer like a normal advance does.
  return reduceTimer(newState, 'local-as-global', null, now)
}
