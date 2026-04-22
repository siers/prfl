import { renderToString } from 'react-dom/server'
import React, { JSX, RefObject, useEffect, useRef } from 'react'

import { evalContentsMem } from './RandomizeLang.js'
import { makeEmptyMemory, Memory } from './RandomizeLangTypes.js'
import { UserItem, cardReviewed, toUserItem } from './RandomizeTypes.js'
import { Timer, TimerCommand, hm, ms, padRight, freshTimer, freshTimerOrRestart, toStartedTimer, toStoppedTimer, timerLength } from './Timers.ts'

import { mapParse, mapSerialize } from '../lib/Map.js'
import { arrayMove, directRange } from '../lib/Array.js'

import murmur from 'murmurhash3js'

const currentStateVersion = 4

type RState = {
  version: 4,
  text?: string,

  items?: UserItem[],
  outLineCount?: number,
  memory?: string,
  nextMemory?: string,

  execute: boolean,
  current?: number,
  hideDone?: boolean,
  totalTimer?: Timer,
}


type Args = {
  eval?: boolean,
  contents?: string,
  save?: boolean,
  execute?: boolean,
  advance?: number,
  hideDone?: boolean,
}

function Randomize(controls: any): JSX.Element {
  const { setState, advanceRef } = controls

  let state = controls.state // one mutation only for checking the version and invalidating the whole state
  const stateVersion = state && state.version || 0

  if (stateVersion != 0 && stateVersion != currentStateVersion) setState((_: any) => null)

  const current = state?.current || 0

  const items: UserItem[] = state?.items || []
  const outLineCount: number = state?.outLineCount || 0
  const doneCount: number = items.filter(i => i.done !== true).length

  const globalTimer = state?.totalTimer
  const localTimer = items[current]?.timer
  const localTimerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(document.createElement("div"))
  const totalTimerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(document.createElement("div"))

  const inExecution: boolean = state?.execute === true
  const inPlanning: boolean = state?.execute !== true

  const hideDone = state?.hideDone !== false

  function renderTimerToRef(ref: RefObject<HTMLDivElement>, timer: Timer | null) {
    ref.current && (ref.current.innerHTML = renderToString(timerContent(timer)))
  }

  useEffect(() => {
    if (state?.execute !== true) return () => { }
    const id = setInterval(() => { renderTimerToRef(totalTimerRef, globalTimer); renderTimerToRef(localTimerRef, localTimer) }, 45.33)
    return () => clearInterval(id)
  }, [items, current, globalTimer, state?.execute])

  advanceRef.current = (advance: string | boolean, _event: any) => {
    const advanceDelta =
      advance == 'next'
        ? 1
        : advance == 'prev'
          ? -1 :
          advance ? 1 : 0

    // if (Math.abs(advanceDelta) == 1 && current + 1 == outLineCount) newAndRecalculate({ eval: true })
    if (Math.abs(advanceDelta) == 1) newAndRecalculate({ advance: advanceDelta })
    modifyTimer('local-as-global')
  }

  useEffect(() => {
    if (state === null || state?.items?.length == 0) return () => { }
    if (inPlanning && localTimer?.kind !== 'stopped') modifyTimer('stop')
  }, [items, current, inExecution])

  function seekCurrent(
    current: number,
    advance: number,
    lineCount: number,
    hideDone: boolean,
    items: UserItem[],
  ): number {
    const index = seekCurrentUnbounded(current, advance, lineCount, hideDone, items)

    return Math.max(0, Math.min(index, lineCount - 1))
  }

  function itemSkipped(item?: UserItem) {
    return item?.separator == true || item?.done == true
  }

  function seekCurrentUnbounded(
    current: number,
    advance: number,
    lineCount: number,
    hideDone: boolean,
    items: UserItem[],
  ): number {
    if (hideDone) {
      let recursionGuard = 500

      while (advance) {
        while (hideDone && Math.abs(advance) > 0 && (current >= 0 && current < lineCount) && recursionGuard-- > 0) {
          current += Math.sign(advance)
          if (!itemSkipped(items[current])) break
        }

        advance -= Math.sign(advance)
      }
    }

    return current + advance
  }

  function seekCurrentItem(
    current: number,
    advance: number,
    lineCount: number,
    hideDone: boolean,
    items: UserItem[],
  ): { item: UserItem | null, index: number, unbounded: boolean } {
    const index = seekCurrentUnbounded(current, advance, lineCount, hideDone, items)
    return { item: items[index], index, unbounded: !items[index] }
  }

  function newAndRecalculate(a: Args) {
    setState((s: RState | undefined) => {
      const contentsOr = a.contents === '' ? a.contents : (a.contents || state?.text || '')
      const execute = a.execute === undefined ? state?.execute : a.execute
      const hideDone = a.hideDone === undefined ? state?.hideDone : a.hideDone

      let items: UserItem[] = s?.items || []
      let newMemory: Memory | undefined = undefined
      let nextTotalTimer: Timer | undefined = state?.totalTimer

      if (a.eval) {
        const oldMemory = (state?.memory && mapParse(state.memory)) || makeEmptyMemory()
        // console.clear()
        const [lines, memory] = evalContentsMem(contentsOr, oldMemory)
        newMemory = memory
        items = lines.map(rl => toUserItem(rl))
        nextTotalTimer = undefined
      }

      const nextItems = items === undefined ? s?.items : items
      const lineCount = items.length

      const savedMemory = newMemory !== undefined ? { nextMemory: mapSerialize(newMemory) } : {}
      // saving memory with the global button is superseded by review buttons
      const nextMemory = ((s?.nextMemory && false) ? { memory: s?.nextMemory, nextMemory: undefined } : {})

      const nextCurrent = seekCurrent(s?.current || 0, a.advance || 0, lineCount, hideDone, items)

      return {
        version: currentStateVersion,

        ...s,
        text: contentsOr,

        items: nextItems,
        outLineCount: lineCount,
        ...savedMemory,
        ...nextMemory,

        execute: execute,
        current: a.eval ? 0 : nextCurrent,
        hideDone: hideDone,
        totalTimer: nextTotalTimer,
      } satisfies RState
    })
  }

  function modifyTimerPure(
    t: Timer | null,
    command: TimerCommand,
    now: number,
  ): Timer {
    if (command == 'start' || command == 'restart') {
      return (!t || command == 'restart') ? freshTimerOrRestart(now, t) : toStartedTimer(t, now)
    }

    if (command == 'stop') {
      return toStoppedTimer(t || freshTimer(now), now)
    }

    return freshTimer(0) // impossible
  }

  function modifyTimer(commandIn: TimerCommand, target: null | 'local' = null) {
    setState((s: RState | undefined) => {
      const now = Date.now()
      if (!s) return s

      const command = commandIn == 'local-as-global' ? s?.totalTimer?.kind == 'started' ? 'start' : 'stop' : commandIn

      return {
        ...s,
        totalTimer: target != 'local' ? modifyTimerPure(s?.totalTimer || null, command, now) : s?.totalTimer,
        items: (s.items || []).map((item, index) => {
          return {
            ...item,
            timer: modifyTimerPure(item.timer, index == s?.current ? command : 'stop', now),
          }
        })
      }
    })
  }

  function modifyItem(controls: { reviewed: boolean, done: boolean, bury: boolean }) {
    setState((s: RState | undefined) => {
      if (!s) return s

      const items = s.items || []
      const move = controls.bury === true

      const memory = s?.memory ? mapParse(s.memory) : makeEmptyMemory()

      if (controls.reviewed === true && items[current].key) cardReviewed(memory, items[current].key, Date.now())
      // else console.log(`card burried, can't mark ${JSON.stringify(items[current])} reviewed`)

      const updatedItems = items.map((item, index) => {
        if (index != current) return item
        else return { ...item, done: controls.done }
      })

      const updatedItems2 = move ? arrayMove(updatedItems, current, (s?.items?.length || 0) - 1) : updatedItems

      return {
        ...s,
        memory: mapSerialize(memory),
        items: updatedItems2,
      }
    })

    if (controls.done) advanceRef.current('next')
    else modifyTimer('local-as-global')
  }

  // UI

  function timerContent(timer: Timer | null): string {
    const formatted = (timer: Timer) => padRight(ms(timerLength(timer, Date.now())), 10, ' ')
    return (timer && (formatted(timer))) || ''
  }

  function planningControlButtons(): JSX.Element {
    return <>
      { /* <a className="pr-3 select-none" style={state?.nextMemory ? {} : { opacity: '50%' }} onClick={() => newAndRecalculate({ save: true })}>💾</a> */}
      <a className="pr-3 select-none" onClick={() => newAndRecalculate({ eval: true, })}>🔄</a>
      <a className="pr-3 select-none" onClick={() => confirm('delete?') && newAndRecalculate({ eval: true, contents: '', execute: false })}>❌{/* right now this breaks history of textarea */}</a>

      <span className="pr-3">
        {state?.outLineCount ? <>{state?.outLineCount} * 4min = {hm(state.outLineCount * 4)}</> : <></>}
      </span>
      <span className="pr-3 text-[#f4f4f4]">
        {state?.memory && Math.abs(murmur.x86.hash32(state.memory)) % 10000}
      </span>
    </>
  }

  function executionControlButtons(): JSX.Element {
    return <>
      <a className="pr-3 select-none" style={{ opacity: hideDone ? '0.5' : '1' }} onClick={() => newAndRecalculate({ hideDone: !hideDone, })}>👁️</a>
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
    const color =
      index == current ? undefined
        : item.done ? '#4caf50'
          : timerLength(item.timer, Date.now()) >= 180 ? 'orange'
            : '#bbb'
    return {
      ...(index == current && { fontSize: '2rem' }),
      ...(color && { color })
    }
  }

  function executionItems(): JSX.Element {
    const show = directRange(-2, 2)

    return <div className="w-full flex flex-col flex-grow justify-center select-none">
      {show.map(s => {
        return seekCurrentItem(current, s, outLineCount, hideDone, items)
      }).map(({ item, index, unbounded }) => {
        if (unbounded || !item) return null
        return <div key={index} className="w-full text-center text-wrap" style={itemStyle(item, index)}>
          {item.contents}
        </div>
      })}
    </div>
  }

  function executionStats(): JSX.Element {
    const timerControls = <>
      <span onClick={() => modifyTimer(localTimer?.running ? 'stop' : 'start')} className="pt-3 pb-3 pl-2 pr-2 select-none">{localTimer?.running ? '⏸️' : '▶️'}</span>
      <span onClick={() => modifyTimer('restart', 'local')} className="pt-3 pb-3 pl-2 pr-2 select-none">🔄</span>
    </>

    const currentMap = items.flatMap((i, ith) => itemSkipped(i) ? [] : [ith]).map((ith, jth) => [ith, jth])
    const shownItemNr = Object.fromEntries(currentMap)[current]
    const currentItemNr = 1 + (hideDone ? shownItemNr : current)

    return <div className="w-full pb-2 text-center font-mono">
      <div className="text-[#888]">{currentItemNr}/{doneCount}{outLineCount != doneCount ? `(${outLineCount})` : ''}</div>

      <div className="flex flex-row justify-center">
        <a className="pr-3 select-none" onClick={() => modifyItem({ reviewed: true, done: true, bury: false })}>✅</a>
        <a className="pr-3 select-none text-[#000]">&nbsp;</a>
        <a className="pr-3 select-none" onClick={() => modifyItem({ reviewed: false, done: false, bury: true })}>✘</a>
        <a className="pr-3 select-none" onClick={() => modifyItem({ reviewed: false, done: true, bury: false })}>📚</a>
        <a className="pr-3 select-none" onClick={() => modifyItem({ reviewed: true, done: true, bury: false })}>💤</a>
      </div>

      <div className="flex flex-row justify-center">
        <div className="w-[7em] p-3 text-right" ref={totalTimerRef}></div>
        {timerControls}
        <div className="w-[7em] p-3 text-left" ref={localTimerRef}></div>
      </div>
    </div>
  }

  return (
    <div className="w-full">
      <div className="pl-[10px]">
        <a className="pr-3 select-none" onClick={() => { newAndRecalculate({ execute: !inExecution }); !inExecution && modifyTimer('start') }}>{state?.execute ? '⏸️' : '▶️'}</a>
        {inPlanning && planningControlButtons()}
        {inExecution && executionControlButtons()}
      </div>

      {inPlanning && editor()}

      {inExecution &&
        <div className={"w-[100dvw] flex flex-col justfiy-center "} style={({ height: "calc(90dvh)" })}>
          {executionStats()}
          {executionItems()}
        </div>
      }
    </div>
  )
}

export default Randomize

// TODO: global: remove {} brackets in extrapolation, allow entering [] into a subprogram
// TODO: scheduling: use bpolaszek/picker-js instead of the fake weighted random routines
// TODO: execution: rerandomizeable items (doable)
// TODO: scheduling: weights should be proportional to how long ago the task was last picked
// TODO: execution: save all reviews in the card data, along with all lengths
// TODO: lang: add tags to block, only main blocks may have items without keys
// TODO: content: rewrite key picker without memory (divmod on day of the week, use rem for shuffling the array, but sucks, because of day skipping)
// TODO: execution: indicate tasks which are fresh
// TODO: seek: add aan array of valid visited routes, starting with the current route
// TODO: utils: this should be less complicated: [shuffle(pickNKeys('x', 12))]

// TODO: parametrization: decks which you can go deeper into (Piece:aspect:parametrs)
// TODO: parametrization: enable subsets of a column, allow shuffling per-column
// TODO: parametrization: sample hyperspace (pretty unlikely to be done, requires order of items, are the tails sown together?)

// TODO: execution: items embed metronome (or sheet music)
// TODO: execution: rerandomizeable blocks (can't imagine a way to achieve this)

// TODO: content: display programmable scales
// TODO: content: random notes within position
// TODO: content: bow articulations tasks
// TODO: content: maybeEvery derived from memory (make it work on indices)
// TODO: content: random bowing exercises
// TODO: content: bowing pattern generator for detache notes (partition refinement)

// TODO: hard: scheduling: give "gas" to tasks, so they get temporarily bumped

// TODO: backlog: util: cross inside utils with cross on generic arrays + https://www.npmjs.com/package/string-format
// TODO: backlog: interpret: make sure that eval gets a new scope, not window, so it could be wiped between rerandomization (comlink)
// TODO: backlog: execution: scrollable items in execution
