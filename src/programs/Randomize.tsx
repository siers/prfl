import { renderToString } from 'react-dom/server'
import React, { JSX, RefObject, useEffect, useRef } from 'react'

import { emptiedInterpolations, evalContentsMem, evalRenderLine, interpolateSubtToString, interpolateSubtToStringPlain, renderLineContentWithTags, rotateInterpolableLine } from './RandomizeLang.js'
import { ContentOrTag, makeEmptyMemory, Memory, RenderLine, Substitution } from './RandomizeLangTypes.js'
import { CardData, UserItem, cardSet, findCard, toUserItem } from './RandomizeTypes.js'
import { Timer, padRight, freshTimer, freshTimerOrRestart, toStartedTimer, toStoppedTimer, timerLength, timerSubtract, hm_ms, ms, hoursBetweenNow } from './Timers.ts'

import { mapParse, mapSerialize } from '../lib/Map.js'
import { arrayMove } from '../lib/Array.js'

import murmur from 'murmurhash3js'
import { clamp, parseInt } from 'lodash'
import { linearSeekFullNext, linearSeekNext } from './LinearSeek.ts'
import { Metro } from './Metro.tsx'
import SheetOSMD from './SheetOSMD.tsx'
import { ErrorBoundary } from 'react-error-boundary'

const currentStateVersion = 4

type RState = {
  version: 4,
  text?: string,

  items?: UserItem[],
  outLineCount?: number,
  memory?: string,
  nextMemory?: string,

  execute?: boolean,
  current?: number,
  hideDone?: boolean,
  totalTimer?: Timer,

  metro?: Metro,
}

const defaultState: RState = {
  version: 4,

  text: "Lullaby: play it\nJuggling: do it\nSquats: do it"
}

type Args = {
  eval?: boolean,
  contents?: string,
  save?: boolean,
  execute?: boolean,
  advance?: number,
  hideDone?: boolean,
}

type Metro = {
  opened?: boolean,
  power?: boolean,
  bpm?: number,
}

type MetroDiff = {
  opened?: boolean,
  power?: boolean,
  bpm?: number,
}

const defaultBpm = 60

type TimerCommand = 'start' | 'stop' | 'restart' | 'local-as-global' | 'subtract-and-restart'
type TimerAction = 'start' | 'stop' | 'restart' | ['subtract', Timer | null] | 'no-op'

type ItemActions = {
  reviewed?: boolean,
  done?: boolean,
  bury?: boolean,
  regenerate?: 'new' | 'next',
  regenerateKey?: string,
  unreview?: boolean,
}

function Randomize(controls: any): JSX.Element {
  const { setState, advanceRef } = controls

  let state = controls.state || defaultState // one mutation only for checking the version and invalidating the whole state
  const stateVersion = state && state.version || 0

  if (stateVersion != 0 && stateVersion != currentStateVersion) setState((_: any) => null)

  const items: UserItem[] = state?.items || []
  const outLineCount: number = state?.outLineCount || 0

  const current = state?.current || 0

  const globalTimer = state?.totalTimer
  const localTimer = items[current]?.timer
  const localTimerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(document.createElement("div"))
  const totalTimerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(document.createElement("div"))

  const inExecution: boolean = state?.execute === true
  const inPlanning: boolean = state?.execute !== true

  const hideDone = state?.hideDone !== false

  function renderTimerToRef(ref: RefObject<HTMLDivElement>, timer: Timer | null, type: 'local' | 'global') {
    ref.current && (ref.current.innerHTML = renderToString(timerContent(timer, type)))
  }

  useEffect(() => {
    if (state?.execute !== true) return () => { }
    const id = setInterval(() => { renderTimerToRef(totalTimerRef, globalTimer, 'global'); renderTimerToRef(localTimerRef, localTimer, 'local') }, 45.33)
    return () => clearInterval(id)
  }, [items, current, globalTimer, state?.execute])

  advanceRef.current = (advance: string | boolean, _event: any) => {
    const advanceDelta =
      advance == 'next'
        ? 1
        : advance == 'prev'
          ? -1 :
          advance ? 1 : 0

    if (advanceDelta == 0) return

    // if (Math.abs(advanceDelta) == 1 && current + 1 == outLineCount) newAndRecalculate({ eval: true })
    if (Math.abs(advanceDelta) == 1) newAndRecalculate({ advance: advanceDelta })
    modifyTimer('local-as-global')
  }

  useEffect(() => {
    if (state === null || state?.items?.length == 0) return () => { }
    if (inPlanning && localTimer?.kind !== 'stopped') modifyTimer('stop')
  }, [items.length && items || null, current, inExecution])

  function memoryFromState(s: RState | undefined, kind: string = 'old') {
    const mem = kind == 'new' ? s?.nextMemory : s?.memory
    return (mem && mapParse(mem)) || makeEmptyMemory()
  }

  function itemSkipped(item?: UserItem) {
    return item?.separator == true || item?.done == true
  }

  function itemSeekExclude(item: UserItem): boolean {
    return hideDone && itemSkipped(item)
  }

  function findCardFromMemory(item?: UserItem): CardData | null {
    return findCard(memoryFromState(state), item?.key || '')
  }

  function newAndRecalculate(a: Args) {
    setState((s: RState | undefined) => {

      const contentsOr = a.contents === '' ? a.contents : (a.contents || state?.text || '')
      const execute = a.execute === undefined ? state?.execute : a.execute
      const hideDone = a.hideDone === undefined ? state?.hideDone : a.hideDone

      const initMemory = memoryFromState(s)

      let items: UserItem[] = s?.items || []
      let newMemory: Memory | undefined = undefined
      let nextTotalTimer: Timer | undefined = state?.totalTimer

      if (a.eval || items.length == 0) {
        // console.clear()
        const [lines, memory] = evalContentsMem(contentsOr, initMemory)
        newMemory = memory
        items = lines.map(rl => toUserItem(rl))
        nextTotalTimer = undefined
      }

      const nextItems = items === undefined ? s?.items : items
      const lineCount = items.length

      const savedMemory = newMemory !== undefined ? { nextMemory: mapSerialize(newMemory) } : {}

      const advance = itemSeekExclude(items[current]) ? 1 : (a.advance || 0)
      const nextCurrent: number[] = linearSeekFullNext(items, s?.current || 0, advance, itemSeekExclude)

      const newCard: CardData | null = nextCurrent.length && items[nextCurrent[0]] && items[nextCurrent[0]].key && findCard(initMemory, items[nextCurrent[0]].key || '') || null
      const newBpm: number | undefined = nextCurrent.length && newCard && newCard.bpm ? newCard.bpm : undefined
      const metro: Metro = recalcMetro(s?.metro || {}, { bpm: newBpm })
      setItemBpm(metro.bpm || defaultBpm)

      return {
        version: currentStateVersion,

        ...s,
        text: contentsOr,

        items: nextItems,
        outLineCount: lineCount,
        ...savedMemory,

        execute: execute,
        current: a.eval ? 0 : (nextCurrent.length > 0 ? nextCurrent[0] : s?.current),
        hideDone: hideDone,
        totalTimer: nextTotalTimer,

        metro,
      } satisfies RState
    })
  }

  function modifyTimerPure(
    tIn: Timer | null,
    command: TimerAction,
    now: number,
  ): Timer {
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

  function modifyTimer(commandIn: TimerCommand, target: null | 'local' = null) {
    setState((s: RState | undefined) => {
      const now = Date.now()
      if (!s) return s

      let commandGlobal: TimerAction | undefined
      let commandLocal: TimerAction

      if (commandIn == 'local-as-global') {
        commandLocal = s?.totalTimer?.kind == 'started' ? 'start' : 'stop'
        commandGlobal = 'no-op'
      } else if (commandIn == 'subtract-and-restart') {
        const currentItem = s?.items ? s?.items[current] : null
        commandGlobal = ['subtract', currentItem?.timer || null]
        commandLocal = 'restart'
      } else {
        if (target != 'local') commandGlobal = commandIn
        commandLocal = commandIn
      }

      return {
        ...s,
        totalTimer: modifyTimerPure(s?.totalTimer || null, commandGlobal || 'no-op', now),
        items: (s.items || []).map((item, index) => {
          return {
            ...item,
            timer: modifyTimerPure(item.timer, index == s?.current ? commandLocal : 'stop', now),
          }
        })
      }
    })
  }

  function withStateMemory(s: RState | undefined, f: (memory: any) => void): string {
    const memory = s?.memory ? mapParse(s.memory) : makeEmptyMemory()
    f(memory)
    return mapSerialize(memory)
  }

  function modifyItem(controls: ItemActions) {
    setState((s: RState | undefined) => {
      if (!s) return s

      const items = s.items || []

      const newMemory = withStateMemory(s, memory => {
        if (controls.reviewed === true && items[current].key)
          cardSet(memory, items[current].key, { reviewed: Date.now(), bpm: s?.metro?.bpm })

        if (controls.unreview === true && items[current].key)
          cardSet(memory, items[current].key, { reviewed: 0, })
      })

      const updatedItems = items.map((item, index) => {
        if (index != current) return item
        if (controls.regenerate === 'new') {
          if (!item.source) return item
          return evalRenderLine(item, memoryFromState(s, 'new'))
        } else if (controls.regenerate === 'next') {
          if (!item.source) return item
          return rotateInterpolableLine(item, controls.regenerateKey)
        } else return { ...item, done: controls.done === undefined ? item.done : controls.done }
      })

      const newIndex =
        controls.bury === true
          ? clamp(current + 3, 0, s?.items?.length ? s.items.length - 1 : 0)
          : controls.unreview === true
            ? 0
            : -999 // not moved
      const movedItems = newIndex !== -999 ? arrayMove(updatedItems, current, newIndex) : updatedItems

      return {
        ...s,
        memory: newMemory,
        items: movedItems,
      }
    })

    if (controls.done) advanceRef.current('next')
    else modifyTimer('local-as-global')
  }

  function setItemBpm(bpm: number) {
    setState((s: RState | undefined) => {
      return {
        ...s,
        memory: withStateMemory(s, memory => {
          const key = items[typeof s?.current === 'number' ? s?.current : -1]?.key
          if (key) cardSet(memory, key, { bpm: bpm })
        }),
      }
    })
  }

  // UI

  function timerContent(timer: Timer | null, type: 'local' | 'global'): string {
    const format: (a: number) => string = type == 'local' ? ms : hm_ms
    const formatted = (timer: Timer) => padRight(format(timerLength(timer, Date.now())), 10, ' ')
    return (timer && (formatted(timer))) || ''
  }

  function planningControlButtons(): JSX.Element {
    return <>
      { /* <a className="pr-3 select-none" style={state?.nextMemory ? {} : { opacity: '50%' }} onClick={() => newAndRecalculate({ save: true })}>💾</a> */}
      <a className="pr-3 select-none" onClick={() => newAndRecalculate({ eval: true, })}>🔄</a>
      <a className="pr-3 select-none" onClick={() => confirm('delete?') && newAndRecalculate({ eval: true, contents: '', execute: false })}>❌{/* right now this breaks history of textarea */}</a>

      <span className="pr-3">
        {state?.outLineCount ? <>{state?.outLineCount} items</> : <></>}
      </span>
      <span className="pr-3 text-[#f4f4f4]">
        {state?.memory && Math.abs(murmur.x86.hash32(state.memory)) % 10000}
      </span>
    </>
  }

  function executionControlButtons(): JSX.Element {
    return <>
      <a className="pr-3 select-none" style={{ opacity: hideDone ? '0.5' : '1' }} onClick={() => newAndRecalculate({ hideDone: !hideDone, })}>👁️</a>
      <a className="pr-3 microbreak-button select-none" onClick={e => microBreakTransparencyControl(e)}>🅱️</a>
      <a className="pr-3 metro-button select-none" onClick={_ => metroState({ opened: !metro.opened })}>🥁</a>
      <a className="pr-3" onClick={event => advanceRef.current('prev', event)}>⬅️</a>
      <a className="pr-3" onClick={event => advanceRef.current('next', event)}>➡️</a>
    </>
  }

  function editor(): JSX.Element {
    const lines = items.map(rl => rl.contents).join('\n')

    return <div className={"w-[100dvwh] flex flex-row selection:red text-sm "} style={({ height: "calc(90dvh)" })}>
      <div className="grow p-[10px]">
        <textarea className="block w-full h-full p-[5px] border" cols={130} onChange={e => newAndRecalculate({ contents: e.target.value, eval: true })} value={state?.text}></textarea>
      </div>

      <div className="grow p-[10px]">
        <textarea className="block w-full h-full p-[5px] border font-mono" cols={130} value={lines} readOnly></textarea>
      </div>
    </div>
  }

  function itemStyle(item: UserItem, index: number): React.CSSProperties {
    const card = findCardFromMemory(item)
    const color =
      index == current ? undefined
        : item.done && hoursBetweenNow(card?.reviewed) > 12 ? 'red'
          : item.done ? '#4caf50'
            : timerLength(item.timer, Date.now()) >= 180 ? 'orange'
              : '#bbb'
    return {
      ...(index == current && { fontSize: '2rem' }),
      ...(color && { color })
    }
  }

  function renderContentWithTags(item: RenderLine) {
    const [contentTags, lookupTag] = renderLineContentWithTags(item)
    return <>
      {
        contentTags.map((ct: ContentOrTag, idx: number) =>
          <span key={idx} onClick={_ => ct[0] == 'tag' && modifyItem({ 'regenerate': 'next', 'regenerateKey': ct[1] })}>
            {ct[0] == 'string' ? ct[1] : interpolateSubtToString((lookupTag.get(ct[1]) as Substitution).contents)}
          </span>
        )
      }
    </>
  }

  function executionItems(): JSX.Element {
    const shownItems: [UserItem, number][] = [-1, 0, 1].flatMap(delta => {
      const found = linearSeekNext(items, current, delta, itemSeekExclude)
        .slice(0, delta == 0 ? 1 : Math.abs(delta * 2))
        .map(idx => [items[idx], idx] satisfies [UserItem, number])

      return delta == -1 ? found.reverse() : found
    })

    items.length > 0 && shownItems.length == 0 && shownItems.push([items[current], current])

    return <>
      {shownItems.map(([item, index]) => {
        const isCurrent = index == current
        const showReeval = isCurrent && (items[current]?.source?.interpols?.length || 0) > 0
        const showCheckmark = isCurrent && itemSeekExclude(item)
        return <div key={index} className="w-full text-center text-wrap" style={itemStyle(item, index)}>
          {
            showCheckmark ? <>✅</> : <>
              {isCurrent || !hideDone ? renderContentWithTags(item) : emptiedInterpolations(item).contents}
              {showReeval && <a className="pl-3 select-none" onClick={() => modifyItem({ regenerate: 'new' })}>🔄</a>}
              {showReeval && <a className="pl-3 select-none" onClick={() => modifyItem({ regenerate: 'next' })}>⏩</a>}
            </>
          }
        </div>
      })}
    </>
  }

  function microBreakTransparencyControl(e: React.MouseEvent<HTMLAnchorElement>) {
    const breakMin = 10000
    const breakMax = 15000
    const calcOpacity = (start: number, now: number) => {
      const value = clamp((now - start - breakMin) / (breakMax - breakMin), 0, 1)
      return Math.pow(value, 1.6) // ease-in
    }

    const el = e.currentTarget
    const thisKey = `${parseInt(el.dataset.animationKey || '0') + 1}`
    el.dataset.animationKey = thisKey
    const timeout = 50

    const nextFrame = (key: string, start: number) => {
      const opacity = calcOpacity(start, Date.now())
      if (!(el.dataset.animationKey == key && opacity < 1)) return

      el.style.opacity = `${Math.round(opacity * 100)}%`
      setTimeout(() => nextFrame(key, start), timeout)
    }
    setTimeout(() => nextFrame(thisKey, Date.now()), timeout)
  }

  function recalcMetro(old: Metro, diff: MetroDiff): Metro {
    const diffFilt = Object.fromEntries(Object.entries(diff).filter(([_key, value]) => value != null && value != undefined))
    const fresh = { opened: false, power: false, bpm: defaultBpm, ...old, ...diffFilt }
    fresh.bpm = clamp(Math.floor(fresh.bpm), 20, 500)
    return fresh
  }


  function metroState(diff: MetroDiff) {
    setState((sIn: RState | undefined) => {
      const state = ({ version: 4, ...sIn, metro: recalcMetro(sIn?.metro || {}, diff) })
      setItemBpm(state.metro.bpm || defaultBpm)
      return state
    })
  }

  function executionStats(): JSX.Element {
    const timerControls = <>
      <span onClick={() => modifyTimer(localTimer?.running ? 'stop' : 'start')} className="pb-3 px-2 select-none">{localTimer?.running ? '⏸️' : '▶️'}</span>
      <span onClick={() => modifyTimer('restart', 'local')} className="pb-3 px-2 select-none">🔄</span>
      <span onClick={() => modifyTimer('subtract-and-restart')} className="pb-3 px-2 select-none">⏪</span>
    </>

    const reviewControls = <>
      <a className="pr-4 select-none" onClick={() => modifyItem({ reviewed: true, done: true, bury: false })}>✅</a>
      <a className="pr-4 select-none" onClick={() => modifyItem({ reviewed: false, done: false, bury: true })}>✘</a>
      <a className="pr-4 select-none" onClick={() => modifyItem({ reviewed: false, done: true, bury: false })}>📚</a>
      <a className="pr-4 select-none" onClick={() => modifyItem({ unreview: true, })}>🌟</a>
    </>

    const currentMap = items.flatMap((i, ith) => itemSkipped(i) ? [] : [ith]).map((ith, jth) => [ith, jth])
    const shownItemNr = Object.fromEntries(currentMap)[current]
    const currentItemNr = 1 + (hideDone ? shownItemNr : current)
    const undoneCount = currentMap.length

    const itemCounter = <>{currentItemNr || '-'}/{undoneCount}{outLineCount != undoneCount ? `(${outLineCount})` : ''}</>

    return <div className="w-full pb-2 text-center font-mono">
      <div className="flex flex-row justify-center pt-2">
        <div className="px-4 w-[7em] text-[#888]" ref={totalTimerRef}></div>
        <div className="px-2 w-[7em] text-center" ref={localTimerRef}></div>
        <div className="px-4 w-[7em] text-[#888] text-right">{itemCounter}</div>
      </div>

      <div className="flex flex-row justify-center pt-2">
        <div className="text-left px-5">{reviewControls}</div>
        <div className="text-right px-5">{timerControls}</div>
      </div>
    </div>
  }

  const metro = state?.metro || { bpm: defaultBpm }

  const ticking = !!globalTimer?.running
  const metroPower = ticking && metro.power

  const delinearize = (n: number, low: number, high: number) => (1 - Math.sqrt(1 - (n / 1000))) * (high - low) + low
  const linearize = (n: number, low: number, high: number) => (1 - Math.pow(1 - (n - low) / (high - low), 2)) * 1000

  function metroUI() {
    return <div className="w-full top-0 left-0 p-3 flex-0 font-mono">
      <div className="text-center">
        <div><input type="range" className="w-[80%]" value={linearize(metro.bpm, 20, 500)} onChange={e => metroState({ bpm: delinearize(parseInt(e.target.value), 20, 500) })} min={1} max={1000} /></div>
        <div>
          <span className="p-[1px]" onClick={_ => metroState({ bpm: metro.bpm - 1 })}>-1</span>
          <span className="p-[1px]" onClick={_ => metroState({ bpm: metro.bpm - 5 })}>-5</span>
          <span className="p-[1px]" onClick={_ => metroState({ bpm: metro.bpm * 0.5 })}>÷2</span>
          <span className="p-[1px]" onClick={_ => metroState({ bpm: metro.bpm * 0.333333 })}>÷3</span>
          <span
            className="p-[2px] inline-block text-center w-[4em]"
            onClick={_ => ticking && metroState({ power: !metro.power })}
            style={{ color: metroPower ? '#000' : '#aaa' }}
          >
            @{state?.metro?.bpm}
          </span>
          <span className="p-[2px]" onClick={_ => metroState({ bpm: metro.bpm * 3 })}>3×</span>
          <span className="p-[2px]" onClick={_ => metroState({ bpm: metro.bpm * 2 })}>2×</span>
          <span className="p-[2px]" onClick={_ => metroState({ bpm: metro.bpm + 5 })}>5+</span>
          <span className="p-[2px]" onClick={_ => metroState({ bpm: metro.bpm + 1 })}>1+</span>
        </div>
      </div>
    </div>
  }

  function sheetDisplay(tags: Substitution[]) {
    const params = Object.fromEntries(tags.filter(t => t.tag).map(t => [t.tag, interpolateSubtToStringPlain(t.contents).split(' ')[0]]))

    return <div className="flex flex-col font-mono items-center grow">
      <div className="w-full">
        <ErrorBoundary fallback={<>sheet rendering crash</>}>
          <SheetOSMD params={params} />
        </ErrorBoundary>
      </div>
    </div>
  }

  return (
    <div className="w-full">
      <div className="pl-[10px]">
        <a className="pr-3 select-none" onClick={() => { newAndRecalculate({ execute: !inExecution }); !inExecution && modifyTimer('start') }}>{state?.execute ? '↩️' : '▶️'}</a>
        {inPlanning && planningControlButtons()}
        {inExecution && executionControlButtons()}
      </div>

      {inPlanning && editor()}

      {inExecution &&
        <div className="relative">
          <div className={"w-[100dvw] flex flex-col justfiy-center"} style={({ height: "calc(90dvh)" })}>
            {executionStats()}

            <ErrorBoundary fallback={<>item render crash</>}>
              <div className="relative w-full flex flex-col flex-grow select-none">
                <div className="flex-1 content-center">
                  {executionItems()}
                </div>

                {items[current]?.key?.match(/DS$/) && sheetDisplay(items[current]?.source?.substitutions || [])}

                {metro.opened && metroUI()}
                {metroPower && <Metro bpm={metro.bpm || defaultBpm} />}
              </div>
            </ErrorBoundary>
          </div>
        </div>
      }
    </div>
  )
}

export default Randomize

// gen_tracker_id() { pwgen 4 1 | tr -d '\n' | tr 'a-z' 'A-Z' | xclip; }

// TODO: execution: make items clickable, show all items, make them scrollable
// TODO: execution: hide other items after a small timeout
// TODO: scales: bowings/delete notes replace with pauses
// TODO: scales: remove half-positions in ToneLibViolin
// TODO: parametrization: decks which you can go deeper into
// TODO: state: google drive api (for images)
// TODO: UI: streamlining (useful for scales, swipes)

// TODO: lang: (8HZO) tags to each item
// TODO: scheduling: make item heavier for the scheduler depending on a tag (7RZH)
// TODO: scheduling: queue: pick after every card, because otherwise suspending inside of a zipScheduleBlocks is weird
// TODO: execution: (7RZH) make items just pointers, allowing for refreshing of cards while in the list
// TODO: execution: save card reviews in a list, with review lengths
// TODO: execution: indicate tasks which are complete fresh (no review or the time put in is small)

// TODO: lang: add tags to block, only main blocks may have items without keys
// TODO: content: instead of warmup + aba(block(), block()), make warmup addable optionally (MD4F), then zipped priority cards + non-prio
// TODO: content: (MD4F) would require a special action for that would influence the deck

// TODO: state: use a CRDT-storage server
// TODO: state: check if I can read anki database locally

// TODO: execution: breakout into a subdeck by interpolation explosion
// TODO: execution: interpolations must be orderable by frequency the same way subdecks would
// TODO: execution: interpolation subdecks should combine with zip, randomization will happen in the next practice
// TODO: parametrization: enable subsets of a column, allow shuffling per-column
// TODO: parametrization: sample hyperspace (pretty unlikely to be done, requires order of items, are the tails sown together?)
// TODO: seek: add an array of valid visited routes, starting with the current route
// TODO: (GHQZ) seek: make cursor an opaque, guarded type to enable multi-layer cursors and understand the actual api
// TODO: (GHQZ) seek: make the cursors point to decks by key on a deckmap, no multi-dim decks
// TODO: parametrization: enable adding tags to each interpolation (usecase: _________)
// TODO: parametrization: separator for forwarding the interpolations
// TODO: parametrization: forward button doesn't work when there are two interpolations

// TODO: execution: rerandomizeable blocks (can't imagine a way to achieve this, but try thinking of a good usecase first)

// TODO: content: random notes within position
// TODO: content: bow articulations tasks
// TODO: content: maybeEvery derived from memory (make it work on indices)
// TODO: content: random bowing exercises
// TODO: content: bowing pattern generator for detache notes (partition refinement)
// TODO: content: anki flashcards for all interval pairs between strings or within a string (q: two notes, a: how many semitones apart if projected on to the same string)

// TODO: backlog: metronome: power status is false on start unless permissions are correct
// TODO: backlog: metronome: tap to get rhythm
// TODO: backlog: interpret: make sure that eval gets a new scope, not window, so it could be wiped between rerandomization (comlink)
// TODO: backlog: scheduling: give "gas" to tasks, so they get temporarily bumped (solved by "bury" button and dynamic scheduling by date)

// TODO: closed: how to balance random exposition with integration cards (subdecks may help) (a: just use interpolations as exposition starting points, problem solved)
