// Pure state reducers for Randomize.

import { blockDeckName, blockNames, evalBlockDeck, evalContents, evalContentsMem, evalRenderLine, hashKey, interpolateSubtToStringPlain, rotateInterpolableLine, scheduleItems, setSubstitutionContents, setSubstitutionHead } from './RandomizeLang.js'
import { BlockHeaders, RenderLine, isSounded, makeEmptyMemory } from './RandomizeLangTypes.js'
import { CardData, ItemRef, Lines, UserItem, cardSet, findCard, resolveItem } from './RandomizeTypes.js'
import { Timer, timerLength, freshTimer, freshTimerOrRestart, toStartedTimer, toStoppedTimer, timerSubtract, zeroedStoppedTimer } from './Timers.ts'
import { mapParse, mapSerialize } from '../lib/Map.js'
import { SheetNote, parseSheet } from '../lib/SheetNotation.ts'
import type { ImageEntry } from '../lib/PrflAssets.ts'
import type { DriveFile } from '../lib/GoogleDrive.ts'
import { clamp } from 'lodash'
import { Direction } from './LinearSeek.ts'
import { ListState, dropThree, bottomOfQueue, toTop, toBottom, Exclude } from './GenericList.ts'
import { Decks, DeckCursor, DEFAULT_DECK, decksOf, deckItems, deckGet, deckMapAt, deckSeek, deckSetCurrent } from './Decks.ts'
import { SpawnMode, spawnChildren, spawnDeckName } from './RandomizeDecks.ts'
import { NextAction, findNextSubstitution, parseNextSteps, renderNextSteps, stepNext } from './RandomizeNext.ts'

export const currentStateVersion = 6
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

  // Decks point at their lines by key; the lines live once, in `lines`.
  items?: Decks<ItemRef>,
  lines?: Lines,
  // The named blocks' headers, evaluated with the root deck and kept until the
  // next eval — a subdeck never re-evaluates them.
  blockHeaders?: BlockHeaders,
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

  // The Drive file the text was loaded from, for ♻️ to fetch again.
  driveFile?: DriveFile,

  // Images gathered from the Drive folder, as [filename, rawUrl]. The URL is a frameless media URL with the key embedded.
  images?: ImageEntry[],
}

export const defaultState: RState = {
  version: 6,

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
  last?: boolean,
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

function refSkipped(lines: Lines): (ref: ItemRef) => boolean {
  return ref => ref.done == true || lines[ref.key]?.separator == true
}

export function excludeFor(hideDone: boolean, lines: Lines): Exclude<ItemRef> {
  const skipped = refSkipped(lines)
  return ref => hideDone !== false && skipped(ref)
}

// ── pointers ─────────────────────────────────────────────────────────────────

// Store lines under their keys and point at them. Within a batch the first line
// per key wins; it replaces what was stored under that key before. Lines without
// a key (separators, errors) are keyed by their hash.
export function storeLines(lines: Lines, rls: (RenderLine | UserItem)[]): [Lines, ItemRef[]] {
  const fresh: Lines = {}
  const refs = rls.map(rl => {
    const { timer: _t, done: _d, dropped: _dr, ...line } = rl as UserItem
    const key = line.key ?? hashKey(line.contents)
    if (!(key in fresh)) fresh[key] = { ...line, key }
    return { key } satisfies ItemRef
  })
  return [{ ...lines, ...fresh }, refs]
}

export function resolveDecks(s: RState | undefined): Decks<UserItem> {
  const lines = s?.lines || {}
  return Object.fromEntries(Object.entries(s?.items || {}).map(([deck, refs]) => [deck, refs.map(r => resolveItem(lines, r))]))
}

export function resolveAt(s: RState | undefined, cursor: DeckCursor | undefined): UserItem | undefined {
  const ref = deckGet(s?.items || {}, cursor)
  return ref && resolveItem(s?.lines || {}, ref)
}

// Lines no deck points at any more.
function pruneLines(lines: Lines, decks: Decks<ItemRef>): Lines {
  const used = new Set(Object.values(decks).flatMap(refs => refs.map(r => r.key)))
  return Object.fromEntries(Object.entries(lines).filter(([key]) => used.has(key)))
}

// Version 5 kept whole items in the decks; split them into lines and pointers.
export function migrateV5(s: Omit<RState, 'items'> & { items?: Decks<UserItem> }): RState {
  let lines: Lines = {}
  const items: Decks<ItemRef> = Object.fromEntries(Object.entries(s.items || {}).map(([deck, old]) => {
    const [stored, refs] = storeLines(lines, old)
    lines = stored
    return [deck, refs.map((ref, i) => {
      const { timer, done, dropped } = old[i]
      return {
        ...ref,
        ...(timer !== undefined && { timer }),
        ...(done !== undefined && { done }),
        ...(dropped !== undefined && { dropped }),
      }
    })]
  }))
  return { ...s, version: 6, items, lines }
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
  const fresh = { opened: true, power: false, bpm: defaultBpm, ...old, ...diffFilt }
  fresh.bpm = clamp(Math.floor(fresh.bpm), 20, 500)
  return fresh
}

// ── items ──────────────────────────────────────────────────────────────────

// On a (re)eval we rebuild, otherwise return previous
function itemsAndTimer(
  decks: Decks<ItemRef>,
  lines: Lines,
  m: string | undefined,
  eval_: boolean,
  contents: string,
  total: Timer | undefined,
  stack: DeckCursor[],
  images: ImageEntry[] | undefined,
  headers: BlockHeaders | undefined,
): [Decks<ItemRef>, Lines, Timer | undefined, DeckCursor[], BlockHeaders | undefined] {
  if (!eval_) return [decks, lines, total, stack, headers]

  let memory: Map<any, any> = memoryFromString(m)
  const [evaluated, _, newHeaders] = evalContentsMem(contents, memory, { images })
  const [newLines, refs] = storeLines({}, evaluated)

  return [decksOf(refs), newLines, zeroedStoppedTimer(), [], newHeaders]
}

// Apply an item action to the deck-local flat list. `current` is the in-deck
// index. Returns the new list, new memory, and — for reorders (bury/unreview/last)
// that resolve the cursor themselves — the new in-deck index (else null).
export function modifyItemState(
  inItems: ItemRef[] | undefined,
  lines: Lines,
  m: string | undefined,
  current: number,
  currentMetro: number,
  controls: ItemActions,
  exclude: Exclude<ItemRef>,
  now: number,
  images?: ImageEntry[],
): [ItemRef[], Lines, string, number | null] {
  const items = inItems || []

  const newMemory = withMemory(m, memory => {
    if (controls.reviewed === true && items[current].key)
      cardSet(memory, items[current].key, { reviewed: now, bpm: currentMetro })

    if (controls.unreview === true && items[current].key)
      cardSet(memory, items[current].key, { reviewed: 0, })
  })

  // A re-roll refreshes the line itself, so every pointer to it shows it.
  const line = items[current] && lines[items[current].key]
  const regenerated =
    !line?.source ? null
      : controls.regenerate === 'new' ? evalRenderLine(line, memoryFromString(m), { images })
        : controls.regenerate === 'next' ? rotateInterpolableLine(line, controls.regenerateKey, memoryFromString(m))
          : null
  const updatedLines: Lines = regenerated ? { ...lines, [items[current].key]: regenerated } : lines

  const updatedItems: ItemRef[] = items.map((item, index) => {
    if (index != current || controls.regenerate) return item
    const dropped = typeof item.dropped == 'number' ? item.dropped : 0
    return {
      ...item,
      done: controls.done === undefined ? item.done : controls.done,
      dropped: (dropped + (controls.bury === true ? 1 : 0)) * (controls.unreview === true ? 0 : 1),
    } satisfies ItemRef
  })

  const currentDroppedCount = (updatedItems[current] && updatedItems[current].dropped) || 0
  // bury ("drop down three"), unreview ("to top") and last are GenericList reorders:
  // they move the item and resolve the cursor themselves, so recalc skips its
  // own seek for them (signalled by returning a non-null new current).
  const excludeForBury: Exclude<ItemRef> = it => exclude(it) || ((it.dropped || 0) + 2 <= currentDroppedCount)
  const list: ListState<ItemRef> = { items: updatedItems, current }
  const queueBottom = bottomOfQueue(list, currentDroppedCount, it => it.dropped || 0, exclude)
  const reordered: ListState<ItemRef> | null =
    controls.bury === true ? dropThree(list, excludeForBury, exclude, queueBottom)
      : controls.unreview === true ? toTop(list)
        : controls.last === true ? toBottom(list, exclude)
          : null

  return reordered
    ? [reordered.items, updatedLines, newMemory, reordered.current]
    : [updatedItems, updatedLines, newMemory, null]
}

// ── next tag ────────────────────────────────────────────────────────────────

export function reduceMetroClick(s: RState | undefined): [RState, NextAction | null] {
  if (!s) return [defaultState, null]

  const cursor: DeckCursor = s.current || [DEFAULT_DECK, 0]
  const ref = deckGet(s.items || {}, cursor)
  const line = ref && s.lines?.[ref.key]
  const subst = findNextSubstitution(line?.source?.substitutions)
  if (!ref || !line || !subst) return [s, null]

  const steps = parseNextSteps(subst.contents)
  if (steps.length === 0) return [s, null]

  const [stepped, action] = stepNext(steps)
  const lines = { ...s.lines, [ref.key]: setSubstitutionContents(line, subst.marker, renderNextSteps(stepped)) }

  return [{ ...s, lines }, action]
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

  const items: Decks<ItemRef> = chain.reduce((acc, [[deck, index], command, siblingCommand]) => ({
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
// A `metro` tag on the current card is rewritten to the new bpm so it doesn't
// go stale (and win over the tuned bpm on revisit); 🔄 recovers the authored one.
export function reduceMetro(s: RState | undefined, diff: Metro): RState {
  const metro = recalcMetro(s?.metro || {}, diff)
  const bpm = metro.bpm || defaultBpm
  const withMetro: RState = { version: currentStateVersion, ...s, metro }
  return reduceSetBpm(withItemMetroTag(withMetro, bpm), bpm)
}

function withItemMetroTag(s: RState, bpm: number): RState {
  const ref = deckGet(s.items || {}, s.current || [DEFAULT_DECK, 0])
  const line = ref && s.lines?.[ref.key]
  if (!ref || !line || itemMetroBpm(line) === null || itemMetroBpm(line) === bpm) return s

  const lines = { ...s.lines, [ref.key]: setSubstitutionHead(line, 'metro', String(bpm), memoryFromString(s.memory)) }
  return { ...s, lines }
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

  const [initDecks, initLines, totalTimer, cursorStack, blockHeaders] = itemsAndTimer(s?.items || decksOf<ItemRef>([]), s?.lines || {}, s?.memory, !!a?.eval, contentsOr, s?.totalTimer, s?.cursorStack || [], s?.images, s?.blockHeaders)
  const initItems = deckItems(initDecks, deck)

  // Exclusion is built from the locally-resolved hideDone (which a.hideDone may
  // be flipping in this very update), not a stale closure.
  const excludeSeek = excludeFor(hideDone !== false, initLines)
  const [deckList, lines, memory, reorderedCurrent] = modifyItemState(initItems, initLines, s?.memory, prevCursor[1], deps.bpm, a.item || {}, excludeSeek, deps.now, s?.images)
  const memoryMap = mapParse(memory)

  // The cursor is resolved by GenericList: a bury/unreview reorder already set
  // it; otherwise translate the advance request into a seek/set/stay.
  const decksAfterReorder: Decks<ItemRef> = { ...initDecks, [deck]: deckList }
  const reorderedCursor: DeckCursor = [deck, reorderedCurrent !== null ? reorderedCurrent : prevCursor[1]]
  const seekDirection = a.advance?.at(0) === "seek" ? (a.advance[1]! as Direction) : null
  const [resolvedDecks, resolvedCursor]: [Decks<ItemRef>, DeckCursor] =
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

  const newRef = deckGet(resolvedDecks, nextCursor)
  const newItem = newRef && resolveItem(lines, newRef)
  const newKey = newItem && newItem.key
  const newCard: CardData | null = newKey && findCard(memoryMap, newItem.key || '') || null
  const newBpm: number = itemMetroBpm(newItem) ?? newCard?.bpm ?? s?.metro?.bpm ?? defaultBpm
  const metro: Metro = newKey ? recalcMetro(s?.metro || {}, { bpm: newBpm }) : (s?.metro || {})

  const newState = {
    version: currentStateVersion,

    ...s,
    text: contentsOr,

    items: resolvedDecks,
    lines,
    blockHeaders,
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
  const parent: UserItem | undefined = resolveAt(s, cursor)
  if (!parent) return s

  const hasOrderedTag = parent.source?.substitutions?.some(s => s.tags?.some(t => t == "ordered"))
  const scheduler = hasOrderedTag ? scheduleIdentity : schedule

  const children = spawnChildren(parent, mode)
  if (children.length === 0) return s // nothing to expand

  const deckName = spawnDeckName(parent, mode)
  const existing = s.items?.[deckName]
  const reusable = existing && existing.some(i => !refSkipped(s.lines || {})(i))
  const [lines, scheduled] = reusable ? [s.lines || {}, existing] : storeLines(s.lines || {}, scheduler(children, s.memory))

  const items: Decks<ItemRef> = { ...(s.items || {}), [deckName]: scheduled }
  const newCursor: DeckCursor = descendCursor({ ...s, lines }, items, deckName)

  const newState: RState = {
    ...s,
    version: currentStateVersion,
    items,
    lines,
    current: newCursor,
    cursorStack: [...(s.cursorStack || []), cursor],
  }

  // Start the descended item's timer like a normal advance does.
  return reduceTimer(newState, 'local-as-global', null, now)
}

function descendCursor(s: RState, decks: Decks<ItemRef>, deckName: string): DeckCursor {
  return deckSetCurrent(decks, [deckName, 0], 0, excludeFor(s.hideDone !== false, s.lines || {}))[1]
}

function subdeckPrefix(item: UserItem): string {
  return `${item.key ?? item.contents}/`
}

export function liveSubdeckName(s: RState | undefined, item: UserItem): string | null {
  const prefix = subdeckPrefix(item)
  const skipped = refSkipped(s?.lines || {})
  const found = Object.entries(s?.items || {}).find(([deck, items]) => deck.startsWith(prefix) && items.some(i => !skipped(i)))
  return found ? found[0] : null
}

// The block an item can instantiate a subdeck from: the named block sharing
// the item's key.
function subdeckBlock(s: RState | undefined, item: UserItem): string | null {
  return item.key !== null && blockNames(s?.blockHeaders || []).has(item.key) ? item.key : null
}

// Is there anything for the "enter subdeck" button to descend into — a live
// deck already, or a block to instantiate one from?
export function hasSubdeck(s: RState | undefined, item: UserItem): boolean {
  return liveSubdeckName(s, item) !== null || subdeckBlock(s, item) !== null
}

// Descend into the item's subdeck. A live deck is entered as-is; otherwise the
// block sharing the item's key is evaluated into a fresh deck, which replaces
// an exhausted one the same way re-spawning does.
export function reduceEnterSubdeck(s: RState | undefined, item: UserItem, now: number): RState {
  if (!s) return defaultState

  const live = liveSubdeckName(s, item)
  if (live) return reduceEnterDeck(s, live, now)

  const name = subdeckBlock(s, item)
  if (name === null) return s

  const lines = evalBlockDeck(s.text || '', name, s.blockHeaders || [], memoryFromString(s.memory), { images: s.images })
  if (lines.length === 0) return s

  const deckName = blockDeckName(name)
  const [stored, refs] = storeLines(s.lines || {}, lines)
  const items: Decks<ItemRef> = { ...(s.items || {}), [deckName]: refs }
  return reduceEnterDeck({ ...s, items, lines: stored }, deckName, now)
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

// Each new pointer takes the progress of an old one with the same key, the nth
// copy the nth's. Returns the old index each new pointer came from, or -1.
function carryProgress(old: ItemRef[], fresh: ItemRef[]): [ItemRef[], number[]] {
  const byKey = new Map<string, number[]>()
  old.forEach((ref, i) => byKey.set(ref.key, [...(byKey.get(ref.key) || []), i]))

  const sources = fresh.map(ref => byKey.get(ref.key)?.shift() ?? -1)
  return [fresh.map((ref, j) => sources[j] == -1 ? ref : old[sources[j]]), sources]
}

// Re-evaluate the text without losing progress: the root deck is rebuilt from
// the text in its new order, but done/timer/dropped carry over by key (see
// carryProgress), and so does the total timer. Subdecks and the stack stay;
// cursors into the root deck follow their item, or keep their index if it's gone.
export function reduceRefresh(s: RState | undefined, contents: string, now: number): RState {
  if (!s) return defaultState

  const [evaluated, _, blockHeaders] = evalContentsMem(contents, memoryFromString(s.memory), { images: s.images })
  const [fresh, refs] = storeLines({}, evaluated)
  const [root, sources] = carryProgress(deckItems(s.items || {}, DEFAULT_DECK), refs)

  const items: Decks<ItemRef> = { ...(s.items || {}), [DEFAULT_DECK]: root }
  const lines = pruneLines({ ...(s.lines || {}), ...fresh }, items)

  const follow = (cursor: DeckCursor): DeckCursor => {
    if (cursor[0] !== DEFAULT_DECK) return cursor
    const moved = sources.indexOf(cursor[1])
    return [DEFAULT_DECK, moved !== -1 ? moved : cursor[1]]
  }
  const [, current] = deckSeek(items, follow(s.current || [DEFAULT_DECK, 0]), Direction.Zero, excludeFor(s.hideDone !== false, lines))

  const newState: RState = {
    ...s,
    version: currentStateVersion,
    text: contents,
    items,
    lines,
    blockHeaders,
    outLineCount: root.length,
    current,
    cursorStack: (s.cursorStack || []).map(follow),
  }
  return reduceTimer(newState, 'local-as-global', null, now)
}

// New text keeps the progress once a session is underway — the total timer past
// 10 seconds; before that it starts over.
export function reduceNewText(s: RState | undefined, contents: string, deps: RecalcDeps): RState {
  return timerLength(s?.totalTimer ?? null, deps.now) > 10
    ? reduceRefresh(s, contents, deps.now)
    : reduceRecalc(s, { contents, eval: true }, deps)
}

export function reduceInsertItem(s: RState | undefined, dsl: string, now: number): RState {
  if (!s) return defaultState

  const [lines, inserted] = storeLines(s.lines || {}, evalContents(dsl, { images: s.images }))
  if (inserted.length === 0) return s

  const [deck, index] = s.current || [DEFAULT_DECK, 0]
  const deckList = deckItems(s.items || {}, deck)
  const at = index + 1
  const newDeckList = [...deckList.slice(0, at), ...inserted, ...deckList.slice(at)]

  const newState: RState = {
    ...s,
    items: { ...(s.items || {}), [deck]: newDeckList },
    lines,
    outLineCount: newDeckList.length,
    current: [deck, at],
  }
  return reduceTimer(newState, 'local-as-global', null, now)
}

export function reduceCleanSubdeck(s: RState | undefined, item: UserItem): RState {
  if (!s) return defaultState

  const prefix = subdeckPrefix(item)
  const items = Object.fromEntries(Object.entries(s.items || {}).filter(([deck]) => !deck.startsWith(prefix)))

  return { ...s, items, lines: pruneLines(s.lines || {}, items) }
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
// for that level and trims the stack above it. The levels left behind drop out
// of reduceTimer's chain, so their timers are stopped here.
export function reducePopTo(s: RState | undefined, level: number, now: number): RState {
  if (!s) return defaultState satisfies RState
  const stack = s.cursorStack || []
  if (level < 0 || level >= stack.length) return s // last level = current deck, nothing to pop

  const leftBehind: DeckCursor[] = [...stack.slice(level + 1), s.current || [DEFAULT_DECK, 0]]
  const items = leftBehind.reduce(
    (acc, cursor) => deckMapAt(acc, cursor, it => ({ ...it, timer: it.timer && toStoppedTimer(it.timer, now) })),
    s.items || {},
  )

  const newState: RState = {
    ...s,
    items,
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
