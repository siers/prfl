// Pure state reducers for Randomize.

import { evalContents, evalContentsDecks, evalRenderLine, interpolateSubtToStringPlain, rotateInterpolableLine, scheduleItems, setSubstitutionContents } from './RandomizeLang.js'
import { isSounded, makeEmptyMemory } from './RandomizeLangTypes.js'
import { CardData, UserItem, cardSet, findCard, toUserItem } from './RandomizeTypes.js'
import { Timer, freshTimer, freshTimerOrRestart, toStartedTimer, toStoppedTimer, timerSubtract, zeroedStoppedTimer } from './Timers.ts'
import { mapParse, mapSerialize } from '../lib/Map.js'
import { SheetNote, parseSheet } from '../lib/SheetNotation.ts'
import type { ImageEntry } from '../lib/PrflAssets.ts'
import { clamp } from 'lodash'
import { Direction } from './LinearSeek.ts'
import { ListState, dropThree, bottomOfQueue, toTop, Exclude } from './GenericList.ts'
import { Decks, DeckCursor, DEFAULT_DECK, decksOf, deckItems, deckGet, deckSeek, deckSetCurrent } from './Decks.ts'
import { SpawnMode, spawnChildren, spawnDeckName } from './RandomizeDecks.ts'
import { NextAction, findNextSubstitution, parseNextSteps, renderNextSteps, stepNext } from './RandomizeNext.ts'

export const currentStateVersion = 5
export const defaultBpm = 60

export type DeckIndex = DeckCursor

export type Metro = {
  opened?: boolean,
  power?: boolean,
  bpm?: number,
  volume?: number,
  timer?: TimerCommand,
}

export type RState = {
  version: number,
  text?: string,

  items?: Decks<UserItem>,
  outLineCount?: number,
  memory?: string,
  nextMemory?: string,

  execute?: boolean,
  current?: DeckIndex,
  // Decks you descended into, parent-first. Spawning pushes the parent cursor.
  cursorStack?: DeckCursor[],
  hideDone?: boolean,
  countTotal?: boolean,
  totalTimer?: Timer,

  metro?: Metro,

  // Images gathered from the Drive folder, as [filename, rawUrl]. The URL is a frameless media URL with the key embedded.
  images?: ImageEntry[],
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
  burst?: string,
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

// ── helpers ──────────────────────────────────────────────────────────

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

export function itemMetroBpm(item?: UserItem): number | null {
  const subst = (item?.source?.substitutions || []).find(s => s.tag === 'metro')
  if (!subst) return null

  const parsed = parseFloat(String(subst.contents[0] ?? '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

// The pitches the metro should sound. Engraving and sounding are separate
// concerns: a `sheet` tag is silent unless it opts in with a `tones` modifier.
// Measures are flattened — bar lines don't affect the sounding sequence.
export function itemMetroTones(item?: UserItem): SheetNote[] {
  const subst = (item?.source?.substitutions || [])
    .find(s => s.tag === 'tones' || (s.tag === 'sheet' && isSounded(s)))
  if (!subst) return []

  const { measures, errors } = parseSheet(interpolateSubtToStringPlain(subst.contents))
  errors.length > 0 && console.warn('metro tones:', errors)

  return measures.flat()
}

export function recalcMetro(old: Metro, diff: Metro): Metro {
  const diffFilt = Object.fromEntries(Object.entries(diff).filter(([_key, value]) => value != null && value != undefined))
  const fresh = { opened: false, power: false, bpm: defaultBpm, ...old, ...diffFilt }
  fresh.bpm = clamp(Math.floor(fresh.bpm), 20, 500)
  return fresh
}

// ── items ──────────────────────────────────────────────────────────────────

// On a (re)eval we rebuild, otherwise return previous
function itemsAndTimer(
  decks: Decks<UserItem>,
  m: string | undefined,
  eval_: boolean,
  contents: string,
  total: Timer | undefined,
  stack: DeckCursor[],
  images: ImageEntry[] | undefined,
): [Decks<UserItem>, Timer | undefined, DeckCursor[]] {
  if (!eval_) return [decks, total, stack]

  let memory: Map<any, any> = memoryFromString(m)
  const [lines, subdecks, _] = evalContentsDecks(contents, memory, { images })

  // `-=- name::` blocks land as decks of their own alongside the root deck, and
  // the root card the lang emitted for each (keyed with the deck name) is what
  // the "enter subdeck" button hangs off — same path spawned decks use.
  const declared: Decks<UserItem> = Object.fromEntries(
    Object.entries(subdecks).map(([name, items]) => [name, items.map(rl => toUserItem(rl))]),
  )

  return [{ ...decksOf(lines.map(rl => toUserItem(rl))), ...declared }, zeroedStoppedTimer(), []]
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
  images?: ImageEntry[],
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
      return evalRenderLine(item, memoryFromString(m), { images }) satisfies UserItem
    } else if (controls.regenerate === 'next') {
      if (!item.source) return item
      return rotateInterpolableLine(item, controls.regenerateKey, memoryFromString(m))
    } else {
      const dropped = typeof item.dropped == 'number' ? item.dropped : 0
      return {
        ...item,
        done: controls.done === undefined ? item.done : controls.done,
        dropped: (dropped + (controls.bury === true ? 1 : 0)) * (controls.unreview === true ? 0 : 1),
      } satisfies UserItem
    }
  })

  const currentDroppedCount = (updatedItems[current] && updatedItems[current].dropped) || 0
  // bury ("drop down three") and unreview ("to top") are GenericList reorders:
  // they move the item and resolve the cursor themselves, so recalc skips its
  // own seek for them (signalled by returning a non-null new current).
  const excludeForBury: Exclude<UserItem> = it => exclude(it) || ((it.dropped || 0) + 2 <= currentDroppedCount)
  const list: ListState<UserItem> = { items: updatedItems, current }
  const queueBottom = bottomOfQueue(list, currentDroppedCount, it => it.dropped || 0, exclude)
  const reordered: ListState<UserItem> | null =
    controls.bury === true ? dropThree(list, excludeForBury, exclude, queueBottom)
      : controls.unreview === true ? toTop(list)
        : null

  return reordered
    ? [reordered.items, newMemory, reordered.current]
    : [updatedItems, newMemory, null]
}

// ── next tag ────────────────────────────────────────────────────────────────

export function reduceMetroClick(s: RState | undefined): [RState, NextAction | null] {
  if (!s) return [defaultState, null]

  const cursor: DeckCursor = s.current || [DEFAULT_DECK, 0]
  const item = deckGet(s.items || {}, cursor)
  const subst = findNextSubstitution(item?.source?.substitutions)
  if (!item || !subst) return [s, null]

  const steps = parseNextSteps(subst.contents)
  if (steps.length === 0) return [s, null]

  const [stepped, action] = stepNext(steps)
  const newItem: UserItem = { ...item, ...setSubstitutionContents(item, subst.marker, renderNextSteps(stepped)) }

  const [deck, index] = cursor
  const items: Decks<UserItem> = {
    ...(s.items || {}),
    [deck]: deckItems(s.items || {}, deck).map((it, i) => i === index ? newItem : it),
  }

  return [{ ...s, items }, action]
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

  const leafCursor: DeckCursor = s?.current || [DEFAULT_DECK, 0]
  const stack = s?.cursorStack || []

  // running-state syncs from totalTimer; elapsed length is per-level, so a subtract corrects every level
  let commandTotal: TimerAction
  let commandLeaf: TimerAction // the leaf may additionally get 'restart', unlike totalTimer
  let ancestorSubtract: TimerAction[] = []

  if (commandIn == 'local-as-global') {
    commandTotal = 'no-op'
    commandLeaf = s?.totalTimer?.kind == 'started' ? 'start' : 'stop'
  } else if (commandIn == 'subtract-and-restart') {
    const minus = deckGet(s.items || {}, leafCursor)?.timer || null
    commandTotal = ['subtract', minus]
    commandLeaf = 'restart'
    ancestorSubtract = [['subtract', minus]]
  } else if (target == 'local') {
    commandTotal = 'no-op'
    commandLeaf = commandIn // restart/start/stop stays leaf-only
  } else {
    commandTotal = commandIn // start/stop
    commandLeaf = commandIn
  }

  const totalTimer = modifyTimerPure(s?.totalTimer || undefined, commandTotal, now)

  const commandUpChain: TimerAction = totalTimer.kind == 'started' ? 'start' : 'stop'
  const commandAncestor: TimerAction[] = [...ancestorSubtract, commandUpChain]

  const chain: [DeckCursor, TimerAction[], TimerAction[]][] = [
    ...stack.map(cursor => [cursor, commandAncestor, ['no-op']] satisfies [DeckCursor, TimerAction[], TimerAction[]]),
    [leafCursor, [commandLeaf], ['stop']],
  ]

  const items: Decks<UserItem> = chain.reduce((acc, [[deck, index], command, siblingCommand]) => ({
    ...acc,
    [deck]: deckItems(acc, deck).map((item, i) => ({
      ...item,
      timer: (i == index ? command : siblingCommand).reduce((t, c) => modifyTimerPure(t, c, now), item?.timer),
    })),
  }), s.items || {})

  return {
    ...s,
    totalTimer,
    items,
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

  // On an eval, itemsAndTimer collapses to a fresh sole "default" deck and an
  // empty stack, so the cursor's deck resets to the root; otherwise we stay on
  // the deck we were in.
  const prevCursor: DeckCursor = s?.current || [DEFAULT_DECK, 0]
  const deck = a.eval ? DEFAULT_DECK : prevCursor[0]

  const [initDecks, totalTimer, cursorStack] = itemsAndTimer(s?.items || decksOf<UserItem>([]), s?.memory, !!a?.eval, contentsOr, s?.totalTimer, s?.cursorStack || [], s?.images)
  const initItems = deckItems(initDecks, deck)

  // Exclusion is built from the locally-resolved hideDone (which a.hideDone may
  // be flipping in this very update), not a stale closure.
  const excludeSeek = excludeFor(hideDone !== false)
  const [deckList, memory, reorderedCurrent] = modifyItemState(initItems, s?.memory, prevCursor[1], deps.bpm, a.item || {}, excludeSeek, deps.now, s?.images)
  const memoryMap = mapParse(memory)

  // The cursor is resolved by GenericList: a bury/unreview reorder already set
  // it; otherwise translate the advance request into a seek/set/stay.
  const decksAfterReorder: Decks<UserItem> = { ...initDecks, [deck]: deckList }
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

  // Seeking off the end of a spawned deck stays on the last item — we do NOT
  // auto-leave the deck on exhaustion. Leaving is explicit (back button /
  // breadcrumb), so finishing all items keeps you in the deck.
  const items = deckItems(resolvedDecks, deck)
  const nextCursor: DeckCursor = a.eval ? [deck, 0] : resolvedCursor

  const newItem = deckGet(resolvedDecks, nextCursor)
  const newKey = newItem && newItem.key
  const newCard: CardData | null = newKey && findCard(memoryMap, newItem.key || '') || null
  const newBpm: number = itemMetroBpm(newItem) ?? newCard?.bpm ?? s?.metro?.bpm ?? defaultBpm
  const metro: Metro = newKey ? recalcMetro(s?.metro || {}, { bpm: newBpm }) : (s?.metro || {})

  const newState = {
    version: currentStateVersion,

    ...s,
    text: contentsOr,

    items: resolvedDecks,
    outLineCount: items.length,
    memory: newKey ? setItemBpmMemory(newKey, memory, metro.bpm || newBpm) : memory,

    execute: execute,
    current: nextCursor,
    cursorStack,
    hideDone: hideDone,
    totalTimer,

    metro,
  } satisfies RState

  return reduceTimer(newState, 'local-as-global', null, deps.now)
}

// How spawned children get ordered. Production uses the schedule sort; tests
// inject identity to keep the order deterministic.
export type Scheduler = (items: UserItem[], memory: string | undefined) => UserItem[]

export const scheduleByMemory: Scheduler = (items, memory) => scheduleItems(items, memoryFromString(memory))
export const scheduleIdentity: Scheduler = (items, _memory) => items

// Spawn a deck from the current item's parameters, descend into it, and push the
// current cursor onto the return stack so exhausting the spawned deck pops back.
// `schedule` re-orders the children (least-recently-reviewed first by default).
export function reduceSpawn(s: RState | undefined, mode: SpawnMode, now: number, schedule: Scheduler = scheduleByMemory): RState {
  if (!s) return defaultState satisfies RState

  const cursor: DeckCursor = s.current || [DEFAULT_DECK, 0]
  const parent: UserItem | undefined = deckGet(s.items || {}, cursor)
  if (!parent) return s

  const hasOrderedTag = parent.source?.substitutions?.some(s => s.tags?.some(t => t == "ordered"))
  const scheduler = hasOrderedTag ? scheduleIdentity : schedule

  const children = spawnChildren(parent, mode)
  if (children.length === 0) return s // nothing to expand

  const deckName = spawnDeckName(parent, mode)
  const existing = s.items?.[deckName]
  const reusable = existing && existing.some(i => !itemSkipped(i))
  const scheduled = reusable ? existing : scheduler(children, s.memory)

  const items: Decks<UserItem> = { ...(s.items || {}), [deckName]: scheduled }
  const newCursor: DeckCursor = descendCursor(s, items, deckName)

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

function descendCursor(s: RState, decks: Decks<UserItem>, deckName: string): DeckCursor {
  return deckSetCurrent(decks, [deckName, 0], 0, excludeFor(s.hideDone !== false))[1]
}

function subdeckPrefix(item: UserItem): string {
  return `${item.key ?? item.contents}/`
}

export function liveSubdeckName(s: RState | undefined, item: UserItem): string | null {
  const prefix = subdeckPrefix(item)
  const found = Object.entries(s?.items || {}).find(([deck, items]) => deck.startsWith(prefix) && items.some(i => !itemSkipped(i)))
  return found ? found[0] : null
}

// Descend into an existing deck by name. Pushes the current cursor on the stack.
export function reduceEnterDeck(s: RState | undefined, deckName: string, now: number): RState {
  if (!s) return defaultState
  if (!(s.items || {})[deckName]) return s

  const newState: RState = {
    ...s,
    current: descendCursor(s, s.items || {}, deckName),
    cursorStack: [...(s.cursorStack || []), s.current || [DEFAULT_DECK, 0]],
  }
  return reduceTimer(newState, 'local-as-global', null, now)
}

export function reduceInsertItem(s: RState | undefined, dsl: string, now: number): RState {
  if (!s) return defaultState

  const inserted = evalContents(dsl, { images: s.images }).map(rl => toUserItem(rl))
  if (inserted.length === 0) return s

  const [deck, index] = s.current || [DEFAULT_DECK, 0]
  const deckList = deckItems(s.items || {}, deck)
  const at = index + 1
  const newDeckList = [...deckList.slice(0, at), ...inserted, ...deckList.slice(at)]

  const newState: RState = {
    ...s,
    items: { ...(s.items || {}), [deck]: newDeckList },
    outLineCount: newDeckList.length,
    current: [deck, at],
  }
  return reduceTimer(newState, 'local-as-global', null, now)
}

export function reduceCleanSubdeck(s: RState | undefined, item: UserItem): RState {
  if (!s) return defaultState

  const prefix = subdeckPrefix(item)
  const items = Object.fromEntries(Object.entries(s.items || {}).filter(([deck]) => !deck.startsWith(prefix)))

  return { ...s, items }
}

// The deck names from the root down to the current deck, for the breadcrumb.
// Each stacked cursor names the deck it points into; the current cursor adds the
// deck you're in now. e.g. stack [['default',2]], current ['Scale/zip',0]
// -> ['default', 'Scale/zip'].
export function deckPath(s: RState | undefined): string[] {
  const stack = s?.cursorStack || []
  const current = s?.current || [DEFAULT_DECK, 0]
  return [...stack.map(c => c[0]), current[0]]
}

// Pop back to a breadcrumb level: level `i` corresponds to deckPath()[i]. The
// last level is the current deck (a no-op). Climbing restores the cursor saved
// for that level and trims the stack above it.
export function reducePopTo(s: RState | undefined, level: number, now: number): RState {
  if (!s) return defaultState satisfies RState
  const stack = s.cursorStack || []
  if (level < 0 || level >= stack.length) return s // last level = current deck, nothing to pop

  const newState: RState = {
    ...s,
    current: stack[level],
    cursorStack: stack.slice(0, level),
  }
  return reduceTimer(newState, 'local-as-global', null, now)
}

// Convenience: climb exactly one level (the back/out button).
export function reducePopOne(s: RState | undefined, now: number): RState {
  const stack = s?.cursorStack || []
  return reducePopTo(s, stack.length - 1, now)
}
