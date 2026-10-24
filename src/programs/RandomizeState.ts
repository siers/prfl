// Pure state reducers for Randomize.

import { blockDeckName, blockNames, evalBlockDeck, evalContentsMem, evalRenderLine, hashKey, interpolateSubtToStringPlain, rotateInterpolableLine, scheduleItems, setSubstitutionContents, setSubstitutionHead } from './RandomizeLang.js'
import { BlockHeaders, RenderLine, isSounded, makeEmptyMemory, orderField } from './RandomizeLangTypes.js'
import { CardData, ItemRef, Lines, UserItem, cardSet, findCard, markStartsDone, resolveItem } from './RandomizeTypes.js'
import { Timer, timerLength, logicalTimerLength, freshTimer, freshTimerOrRestart, toStartedTimer, toStoppedTimer, timerSubtract, zeroedStoppedTimer } from './Timers.ts'
import { mapParse, mapSerialize } from '../lib/Map.js'
import { SheetNote, parseSheet } from '../lib/SheetNotation.ts'
import type { ImageEntry } from '../lib/PrflAssets.ts'
import type { DriveFile } from '../lib/GoogleDrive.ts'
import { clamp, union } from 'lodash'
import { Direction } from './LinearSeek.ts'
import { ListState, dropThree, bottomOfQueue, toTop, toBottom, Exclude } from './GenericList.ts'
import { Decks, DeckCursor, DEFAULT_DECK, decksOf, deckItems, deckGet, deckMapAt, deckSeek, deckSetCurrent } from './Decks.ts'
import { SpawnMode, spawnChildren, spawnDeckName } from './RandomizeDecks.ts'
import { NextAction, findNextSubstitution, parseNextSteps, renderNextSteps, stepNext } from './RandomizeNext.ts'

export const currentStateVersion = 8
export const defaultBpm = 60

export type DeckIndex = DeckCursor

export type Metro = {
  opened?: boolean,
  power?: boolean,
  bpm?: number,
  volume?: number,
  timer?: TimerCommand,
}

// One run through a text: the decks walked through, where you are in them,
// and the clock — what a full eval starts over. Everything outside it carries
// across sessions.
export type Session = {
  text?: string,
  // The Drive file's name, when the text came from one.
  name?: string,
  // When it was first stashed: an unnamed session's stash key is stamped with it.
  created?: number,
  // When it was last the active one; the picker lists the newest first.
  opened?: number,
  // The session picker itself: rebuilt from `sessions` on opening, never stashed.
  picker?: boolean,

  // Decks point at their lines by key; the lines live once, in `lines`.
  items?: Decks<ItemRef>,
  lines?: Lines,
  // Keys of the lines the text defines (`::Key: …`); kept in `lines` even with
  // no deck pointing at them.
  defined?: string[],
  // The named blocks' headers, evaluated with the root deck and kept until the
  // next eval — a subdeck never re-evaluates them.
  blockHeaders?: BlockHeaders,

  current?: DeckIndex,
  // Decks you descended into, parent-first. Spawning pushes the parent cursor.
  cursorStack?: DeckCursor[],
  totalTimer?: Timer,
}

export type RState = {
  version: number,

  // Card memory, and what the text `remember(…)`ed — the latter rewritten on
  // every eval.
  memory?: string,
  nextMemory?: string,

  execute?: boolean,
  hideDone?: boolean,
  countTotal?: boolean,

  metro?: Metro,

  session?: Session,
  // The sessions not active right now, by stash key.
  sessions?: Record<string, Session>,

  // The Drive file the text was loaded from, for ♻️ to fetch again.
  driveFile?: DriveFile,

  // Images gathered from the Drive folder, as [filename, rawUrl]. The URL is a frameless media URL with the key embedded.
  images?: ImageEntry[],
}

export const defaultState: RState = {
  version: 8,

  session: { text: "Lullaby: play it\nJuggling: do it\nSquats: do it" },
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
  ban?: boolean, // false lifts a ban
  fsrs?: boolean, // opts the card into FSRS scheduling; only the first counts
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

// A line that is only its key (`Scales:`, `Scales`) points at a card defined
// elsewhere rather than being one.
function isBare(line: RenderLine): boolean {
  return !line.source && line.contents.trim().replace(/:$/, '') === line.key
}

// Store lines under their keys and point at them. Within a batch the first line
// per key wins; it replaces what was stored under that key before. A bare line
// never replaces anything — it's stored only while its key has no line. Lines
// without a key (separators, errors) are keyed by their hash.
export function storeLines(lines: Lines, rls: (RenderLine | UserItem)[]): [Lines, ItemRef[]] {
  const fresh: Lines = {}
  const refs = rls.map(rl => {
    const { timer: _t, done: _d, dropped: _dr, ...line } = rl as UserItem
    const keyed = { ...line, key: line.key ?? hashKey(line.contents) }
    const key = keyed.key
    const stored = fresh[key] ?? lines[key]
    const replaces = !isBare(keyed) && (!(key in fresh) || isBare(fresh[key]))
    if (!stored || replaces) fresh[key] = keyed
    return { key } satisfies ItemRef
  })
  return [{ ...lines, ...fresh }, refs]
}

// Definitions replace whatever is stored under their keys, the first per key
// winning. Returns their keys too.
export function storeDefinitions(lines: Lines, definitions: RenderLine[]): [Lines, string[]] {
  const fresh: Lines = {}
  for (const d of definitions) {
    const key = d.key ?? hashKey(d.contents)
    if (!(key in fresh)) fresh[key] = { ...d, key }
  }
  return [{ ...lines, ...fresh }, Object.keys(fresh)]
}

export function resolveDecks(s: RState | undefined): Decks<UserItem> {
  const lines = s?.session?.lines || {}
  return Object.fromEntries(Object.entries(s?.session?.items || {}).map(([deck, refs]) => [deck, refs.map(r => resolveItem(lines, r))]))
}

export function resolveAt(s: RState | undefined, cursor: DeckCursor | undefined): UserItem | undefined {
  const ref = deckGet(s?.session?.items || {}, cursor)
  return ref && resolveItem(s?.session?.lines || {}, ref)
}

export function withSession(s: RState, session: Session): RState {
  return { ...s, session: { ...s.session, ...session } }
}

// Lines no deck points at any more, and the text doesn't define.
function pruneLines(lines: Lines, decks: Decks<ItemRef>, defined: string[] = []): Lines {
  const used = new Set([...defined, ...Object.values(decks).flatMap(refs => refs.map(r => r.key))])
  return Object.fromEntries(Object.entries(lines).filter(([key]) => used.has(key)))
}

// Version 7 kept the text at the top level.
export type RStateV7 = Omit<RState, 'session'> & { text?: string, session?: Omit<Session, 'text'> }

export function migrateV7(s: RStateV7): RState {
  const { text, ...rest } = s
  return { ...rest, version: 8, session: { ...s.session, text } }
}

// Version 6 kept the session's fields at the top level.
export type RStateV6 = Omit<RStateV7, 'session'> & Omit<Session, 'text'> & { outLineCount?: number }

export function migrateV6(s: RStateV6): RStateV7 {
  const { items, lines, defined, blockHeaders, outLineCount: _derived, current, cursorStack, totalTimer, ...rest } = s
  return { ...rest, version: 7, session: { items, lines, defined, blockHeaders, current, cursorStack, totalTimer } }
}

// Version 5 kept whole items in the decks; split them into lines and pointers.
export function migrateV5(s: Omit<RStateV6, 'items'> & { items?: Decks<UserItem> }): RStateV6 {
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

// On a (re)eval we rebuild, otherwise return previous. The eval's memory comes
// back too: it holds what the text `remember(…)`ed.
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
  defined: string[] | undefined,
): [Decks<ItemRef>, Lines, Timer | undefined, DeckCursor[], BlockHeaders | undefined, string[] | undefined, string | undefined] {
  if (!eval_) return [decks, lines, total, stack, headers, defined, m]

  const [evaluated, memory, newHeaders, definitions] = evalContentsMem(contents, memoryFromString(m), { images })
  const [pointedLines, refs] = storeLines({}, evaluated)
  const [newLines, newDefined] = storeDefinitions(pointedLines, definitions)

  return [decksOf(markStartsDone(memory, refs)), newLines, zeroedStoppedTimer(), [], newHeaders, newDefined, mapSerialize(memory)]
}

// How long a card must have been worked on for a review to be recorded: a ✅
// as accepted, leaving it unreviewed as unaccepted.
const ACCEPTED_REVIEW_MIN_MS = 10 * 1000
const UNACCEPTED_REVIEW_MIN_MS = 3 * 60 * 1000

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
    const length = logicalTimerLength(items[current]?.timer ?? null, now)

    // Before the review below, so FSRS counts it as the first.
    if (controls.fsrs === true && items[current].key)
      cardSet(memory, items[current].key, { fsrs: now })

    if (controls.reviewed === true && items[current].key)
      cardSet(memory, items[current].key, {
        reviewed: now, bpm: currentMetro,
        ...(length >= ACCEPTED_REVIEW_MIN_MS && { review: { time: now, length, accepted: true } }),
      })

    // Bury and suspend leave it unreviewed: only a long try is worth recording.
    if (controls.reviewed === false && items[current].key && length > UNACCEPTED_REVIEW_MIN_MS)
      cardSet(memory, items[current].key, { review: { time: now, length, accepted: false } })

    if (controls.unreview === true && items[current].key)
      cardSet(memory, items[current].key, { reviewed: 0, })

    if (controls.ban !== undefined && items[current].key)
      cardSet(memory, items[current].key, { banned: controls.ban })
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

  const ss = s.session || {}
  const cursor: DeckCursor = ss.current || [DEFAULT_DECK, 0]
  const ref = deckGet(ss.items || {}, cursor)
  const line = ref && ss.lines?.[ref.key]
  const subst = findNextSubstitution(line?.source?.substitutions)
  if (!ref || !line || !subst) return [s, null]

  const steps = parseNextSteps(subst.contents)
  if (steps.length === 0) return [s, null]

  const [stepped, action] = stepNext(steps)
  const lines = { ...ss.lines, [ref.key]: setSubstitutionContents(line, subst.marker, renderNextSteps(stepped)) }

  return [withSession(s, { lines }), action]
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

  const ss = s.session || {}
  const leafCursor: DeckCursor = ss.current || [DEFAULT_DECK, 0]
  const stack = ss.cursorStack || []

  // running-state syncs from totalTimer; elapsed length is per-level, so a subtract corrects every level
  let commandTotal: TimerAction
  let commandLeaf: TimerAction // the leaf may additionally get 'restart', unlike totalTimer
  let ancestorSubtract: TimerAction[] = []

  if (commandIn == 'local-as-global') {
    commandTotal = 'no-op'
    commandLeaf = ss.totalTimer?.kind == 'started' ? 'start' : 'stop'
  } else if (commandIn == 'subtract-and-restart') {
    const minus = deckGet(ss.items || {}, leafCursor)?.timer || null
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

  const totalTimer = modifyTimerPure(ss.totalTimer || undefined, commandTotal, now)

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
  }), ss.items || {})

  return withSession(s, { totalTimer, items })
}

// ── bpm / metro ──────────────────────────────────────────────────────────────

export function reduceSetBpm(s: RState | undefined, bpm: number): RState {
  const key = deckGet(s?.session?.items || {}, s?.session?.current || [DEFAULT_DECK, 0])?.key
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
  const ss = s.session || {}
  const ref = deckGet(ss.items || {}, ss.current || [DEFAULT_DECK, 0])
  const line = ref && ss.lines?.[ref.key]
  if (!ref || !line || itemMetroBpm(line) === null || itemMetroBpm(line) === bpm) return s

  const lines = { ...ss.lines, [ref.key]: setSubstitutionHead(line, 'metro', String(bpm), memoryFromString(s.memory)) }
  return withSession(s, { lines })
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
  const contentsOr: string = a.contents === '' ? a.contents : (a.contents || s?.session?.text || '')
  const execute = a.execute === undefined ? s?.execute : a.execute
  const hideDone = a.hideDone === undefined ? s?.hideDone : a.hideDone

  // On an eval, itemsAndTimer collapses to a fresh sole "default" deck and an
  // empty stack, so the cursor's deck resets to the root; otherwise we stay on
  // the deck we were in.
  const ss = s?.session || {}
  const prevCursor: DeckCursor = ss.current || [DEFAULT_DECK, 0]
  const deck = a.eval ? DEFAULT_DECK : prevCursor[0]

  const [initDecks, initLines, totalTimer, cursorStack, blockHeaders, defined, evalMemory] = itemsAndTimer(ss.items || decksOf<ItemRef>([]), ss.lines || {}, s?.memory, !!a?.eval, contentsOr, ss.totalTimer, ss.cursorStack || [], s?.images, ss.blockHeaders, ss.defined)
  const initItems = deckItems(initDecks, deck)

  // Exclusion is built from the locally-resolved hideDone (which a.hideDone may
  // be flipping in this very update), not a stale closure.
  const excludeSeek = excludeFor(hideDone !== false, initLines)
  const [deckList, lines, memory, reorderedCurrent] = modifyItemState(initItems, initLines, evalMemory, prevCursor[1], deps.bpm, a.item || {}, excludeSeek, deps.now, s?.images)
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
  // An eval starts over at the top — past any item that comes back banned.
  const nextCursor: DeckCursor = a.eval ? deckSeek(resolvedDecks, [deck, 0], Direction.Zero, excludeSeek)[1] : resolvedCursor

  const newRef = deckGet(resolvedDecks, nextCursor)
  const newItem = newRef && resolveItem(lines, newRef)
  const newKey = newItem && newItem.key
  const newCard: CardData | null = newKey && findCard(memoryMap, newItem.key || '') || null
  const newBpm: number = itemMetroBpm(newItem) ?? newCard?.bpm ?? s?.metro?.bpm ?? defaultBpm
  const metro: Metro = newKey ? recalcMetro(s?.metro || {}, { bpm: newBpm }) : (s?.metro || {})

  const newState = {
    version: currentStateVersion,

    ...s,
    memory: newKey ? setItemBpmMemory(newKey, memory, metro.bpm || newBpm) : memory,

    execute: execute,
    hideDone: hideDone,

    metro,

    session: {
      ...ss,
      text: contentsOr,
      items: resolvedDecks,
      lines,
      defined,
      blockHeaders,
      current: nextCursor,
      cursorStack,
      totalTimer,
    },
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

  const ss = s.session || {}
  const cursor: DeckCursor = ss.current || [DEFAULT_DECK, 0]
  const parent: UserItem | undefined = resolveAt(s, cursor)
  if (!parent) return s

  const hasOrderedTag = parent.source?.substitutions?.some(s => s.tags?.some(t => t == "ordered"))
  const scheduler = hasOrderedTag ? scheduleIdentity : schedule

  const children = spawnChildren(parent, mode)
  if (children.length === 0) return s // nothing to expand

  const deckName = spawnDeckName(parent, mode)
  const existing = ss.items?.[deckName]
  const reusable = existing && existing.some(i => !refSkipped(ss.lines || {})(i))
  const [lines, scheduled] = reusable ? [ss.lines || {}, existing] : storeLines(ss.lines || {}, scheduler(children, s.memory))

  const items: Decks<ItemRef> = { ...(ss.items || {}), [deckName]: markStartsDone(memoryFromString(s.memory), scheduled, now) }
  const newCursor: DeckCursor = descendCursor(s.hideDone, lines, items, deckName)

  const newState: RState = withSession({ ...s, version: currentStateVersion }, {
    items,
    lines,
    current: newCursor,
    cursorStack: [...(ss.cursorStack || []), cursor],
  })

  // Start the descended item's timer like a normal advance does.
  return reduceTimer(newState, 'local-as-global', null, now)
}

function descendCursor(hideDone: boolean | undefined, lines: Lines, decks: Decks<ItemRef>, deckName: string): DeckCursor {
  return deckSetCurrent(decks, [deckName, 0], 0, excludeFor(hideDone !== false, lines))[1]
}

function subdeckPrefix(item: UserItem): string {
  return `${item.key ?? item.contents}/`
}

export function liveSubdeckName(s: RState | undefined, item: UserItem): string | null {
  const prefix = subdeckPrefix(item)
  const skipped = refSkipped(s?.session?.lines || {})
  const found = Object.entries(s?.session?.items || {}).find(([deck, items]) => deck.startsWith(prefix) && items.some(i => !skipped(i)))
  return found ? found[0] : null
}

// The block an item can instantiate a subdeck from: the named block sharing
// the item's key.
function subdeckBlock(s: RState | undefined, item: UserItem): string | null {
  return item.key !== null && blockNames(s?.session?.blockHeaders || []).has(item.key) ? item.key : null
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

  const ss = s.session || {}
  const lines = evalBlockDeck(ss.text || '', name, ss.blockHeaders || [], memoryFromString(s.memory), { images: s.images }, orderField(item))
  if (lines.length === 0) return s

  const deckName = blockDeckName(name)
  const [stored, refs] = storeLines(ss.lines || {}, lines)
  const items: Decks<ItemRef> = { ...(ss.items || {}), [deckName]: markStartsDone(memoryFromString(s.memory), refs, now) }
  return reduceEnterDeck(withSession(s, { items, lines: stored }), deckName, now)
}

// Descend into an existing deck by name. Pushes the current cursor on the stack.
export function reduceEnterDeck(s: RState | undefined, deckName: string, now: number): RState {
  if (!s) return defaultState
  const ss = s.session || {}
  if (!(ss.items || {})[deckName]) return s

  const newState: RState = withSession(s, {
    current: descendCursor(s.hideDone, ss.lines || {}, ss.items || {}, deckName),
    cursorStack: [...(ss.cursorStack || []), ss.current || [DEFAULT_DECK, 0]],
  })
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

  const ss = s.session || {}
  const [evaluated, memory, blockHeaders, definitions] = evalContentsMem(contents, memoryFromString(s.memory), { images: s.images })
  const [pointedLines, refs] = storeLines(ss.lines || {}, evaluated)
  const [fresh, defined] = storeDefinitions(pointedLines, definitions)
  const [carried, sources] = carryProgress(deckItems(ss.items || {}, DEFAULT_DECK), refs)
  const root = markStartsDone(memory, carried, now)

  const items: Decks<ItemRef> = { ...(ss.items || {}), [DEFAULT_DECK]: root }
  const lines = pruneLines(fresh, items, defined)

  const follow = (cursor: DeckCursor): DeckCursor => {
    if (cursor[0] !== DEFAULT_DECK) return cursor
    const moved = sources.indexOf(cursor[1])
    return [DEFAULT_DECK, moved !== -1 ? moved : cursor[1]]
  }
  const [, current] = deckSeek(items, follow(ss.current || [DEFAULT_DECK, 0]), Direction.Zero, excludeFor(s.hideDone !== false, lines))

  const newState: RState = withSession({ ...s, version: currentStateVersion, memory: mapSerialize(memory) }, {
    text: contents,
    items,
    lines,
    defined,
    blockHeaders,
    current,
    cursorStack: (ss.cursorStack || []).map(follow),
  })
  return reduceTimer(newState, 'local-as-global', null, now)
}

// New text keeps the progress once a session is underway — the total timer past
// 10 seconds; before that it starts over.
// Typing into the picker makes it an ordinary session.
export function reduceNewText(s: RState | undefined, contents: string, deps: RecalcDeps): RState {
  const typed = s?.session?.picker ? withSession(s, { picker: undefined }) : s
  return timerLength(typed?.session?.totalTimer ?? null, deps.now) > 10
    ? reduceRefresh(typed, contents, deps.now)
    : reduceRecalc(typed, { contents, eval: true }, deps)
}

export function reduceInsertItem(s: RState | undefined, dsl: string, now: number): RState {
  if (!s) return defaultState

  // A definition updates its card everywhere, inserted or not.
  const [evaluated, , , definitions] = evalContentsMem(dsl, new Map(), { images: s.images })
  const ss = s.session || {}
  const [pointedLines, inserted] = storeLines(ss.lines || {}, evaluated)
  const [lines, newlyDefined] = storeDefinitions(pointedLines, definitions)
  const defined = union(ss.defined || [], newlyDefined)
  if (inserted.length === 0) return newlyDefined.length === 0 ? s : withSession(s, { lines, defined })

  const [deck, index] = ss.current || [DEFAULT_DECK, 0]
  const deckList = deckItems(ss.items || {}, deck)
  const at = index + 1
  const newDeckList = [...deckList.slice(0, at), ...markStartsDone(memoryFromString(s.memory), inserted, now), ...deckList.slice(at)]

  const newState: RState = withSession(s, {
    items: { ...(ss.items || {}), [deck]: newDeckList },
    lines,
    defined,
    current: [deck, at],
  })
  return reduceTimer(newState, 'local-as-global', null, now)
}

export function reduceCleanSubdeck(s: RState | undefined, item: UserItem): RState {
  if (!s) return defaultState

  const prefix = subdeckPrefix(item)
  const ss = s.session || {}
  const items = Object.fromEntries(Object.entries(ss.items || {}).filter(([deck]) => !deck.startsWith(prefix)))

  return withSession(s, { items, lines: pruneLines(ss.lines || {}, items, ss.defined) })
}

// The deck names from the root down to the current deck, for the breadcrumb.
// Each stacked cursor names the deck it points into; the current cursor adds the
// deck you're in now. e.g. stack [['default',2]], current ['Scale/zip',0]
// -> ['default', 'Scale/zip'].
export function deckPath(s: RState | undefined): string[] {
  const stack = s?.session?.cursorStack || []
  const current = s?.session?.current || [DEFAULT_DECK, 0]
  return [...stack.map(c => c[0]), current[0]]
}

// Pop back to a breadcrumb level: level `i` corresponds to deckPath()[i]. The
// last level is the current deck (a no-op). Climbing restores the cursor saved
// for that level and trims the stack above it. The levels left behind drop out
// of reduceTimer's chain, so their timers are stopped here.
export function reducePopTo(s: RState | undefined, level: number, now: number): RState {
  if (!s) return defaultState satisfies RState
  const ss = s.session || {}
  const stack = ss.cursorStack || []
  if (level < 0 || level >= stack.length) return s // last level = current deck, nothing to pop

  const leftBehind: DeckCursor[] = [...stack.slice(level + 1), ss.current || [DEFAULT_DECK, 0]]
  const items = leftBehind.reduce(
    (acc, cursor) => deckMapAt(acc, cursor, it => ({ ...it, timer: it.timer && toStoppedTimer(it.timer, now) })),
    ss.items || {},
  )

  const newState: RState = withSession(s, {
    items,
    current: stack[level],
    cursorStack: stack.slice(0, level),
  })
  return reduceTimer(newState, 'local-as-global', null, now)
}

// Convenience: climb exactly one level (the back/out button).
export function reducePopOne(s: RState | undefined, now: number): RState {
  const stack = s?.session?.cursorStack || []
  return reducePopTo(s, stack.length - 1, now)
}

// ── sessions ─────────────────────────────────────────────────────────────────

// session-YYYYMMDD-HHMM, in local time.
export function sessionStamp(time: number): string {
  const d = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `session-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function freeKey(sessions: Record<string, Session>, base: string): string {
  let key = base
  for (let n = 2; key in sessions; n++) key = `${base}-${n}`
  return key
}

// Put the active session away under its name, or else its creation stamp, with
// its timers stopped. The picker and an empty session are dropped instead.
function stashActive(s: RState, now: number): RState {
  const active = s.session
  const empty = !active?.text && Object.values(active?.items || {}).every(deck => deck.length === 0)
  if (!active || active.picker || empty) return { ...s, session: undefined }

  const sessions = s.sessions || {}
  const stopped = reduceTimer(s, 'stop', null, now).session!
  const created = stopped.created ?? now
  const key = freeKey(sessions, stopped.name ?? sessionStamp(created))
  return { ...s, session: undefined, sessions: { ...sessions, [key]: { ...stopped, created, opened: now } } }
}

// Without any state there's no active session to stash.
function stashOrEmpty(s: RState | undefined, now: number): RState {
  return s ? stashActive(s, now) : { version: currentStateVersion }
}

// Make a stashed session the active one, stashing the active one.
export function reduceLoadSession(s: RState | undefined, key: string, now: number): RState {
  const loaded = s?.sessions?.[key]
  if (!s || !loaded) return s ?? defaultState

  const { [key]: _loaded, ...sessions } = s.sessions!
  return { ...stashActive({ ...s, sessions }, now), session: { ...loaded, opened: now } }
}

// A Drive file names its session. Loading the file the active session came
// from refreshes it like typing does; any other file stashes the active session
// and starts a fresh one. The unattended `?load=` path always starts over, in
// execution.
export function reduceLoadDrive(s: RState | undefined, text: string, file: DriveFile, deps: RecalcDeps, autoLoad = false): RState {
  const base: RState = s && s.session?.name === file.name
    ? s
    : { ...stashOrEmpty(s, deps.now), session: { name: file.name } }
  const loaded = autoLoad
    ? reduceRecalc(base, { contents: text, eval: true, execute: true }, deps)
    : reduceNewText(base, text, deps)
  return { ...loaded, driveFile: file }
}

// A line per stashed session, the most recently active first. The buttons carry
// the session's key as their value, so it's looked up from there rather than
// from the line's own key.
export function pickerText(sessions: Record<string, Session>): string {
  const rows = Object.entries(sessions)
    .sort(([, a], [, b]) => (b.opened ?? 0) - (a.opened ?? 0))
    .map(([key]) => {
      const value = JSON.stringify(key)
      return `${key}: [${value}]load:covered [${value}]delete:covered`
    })
  return ['-=-', ...rows].join('\n')
}

// The picker is a session too: opening it stashes the active one.
export function reduceOpenPicker(s: RState | undefined, deps: RecalcDeps): RState {
  const stashed = stashOrEmpty(s, deps.now)
  const picker: Session = { picker: true, opened: deps.now }
  return reduceRecalc({ ...stashed, session: picker }, { contents: pickerText(stashed.sessions || {}), eval: true }, deps)
}

// Deleting from within the picker rebuilds it, the cursor staying on the row
// that took the deleted one's place.
export function reduceDeleteSession(s: RState | undefined, key: string, deps: RecalcDeps): RState {
  if (!s?.sessions?.[key]) return s ?? defaultState

  const { [key]: _deleted, ...sessions } = s.sessions
  const without: RState = { ...s, sessions }
  if (!s.session?.picker) return without

  const rebuilt = reduceRecalc(without, { contents: pickerText(sessions), eval: true }, deps)
  return reduceRecalc(rebuilt, { advance: ['set', s.session.current?.[1] ?? 0] }, deps)
}
