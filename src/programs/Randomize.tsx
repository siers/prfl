import { renderToString } from 'react-dom/server'
import { mapParse, mapSerialize } from '../lib/Map.js'
import { evalContentsMem } from './RandomizeLang.js'
import { Memory, RenderLine } from './RandomizeLangTypes.js'
import murmur from 'murmurhash3js'
import { JSX, RefObject, useEffect, useRef } from 'react'
import { directRange } from '../lib/Array.js'

import { Timer, Timers, TimerCommand, hm, ms, padRight, freshTimer, freshTimerOrRestart, toStartedTimer, toStoppedTimer, timerLength } from './Timers.ts'

type RState = {
  text?: string,

  items_?: RenderLine[],
  outLineCount?: number,
  memory?: string,
  nextMemory?: string,

  execute: boolean,
  current?: number,
  hideDone?: boolean,
  totalTimer?: Timer,
  timers?: Timers,
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
  const { state, setState, advanceRef } = controls

  const current = state?.current || 0
  const timers: Timers = state?.timers || []

  const items: RenderLine[] = state?.items_ || []
  const outLineCount: number = state?.outLineCount || 0

  const globalTimer = state?.totalTimer
  const localTimer = timers[current]
  const localTimerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(document.createElement("div"))
  const totalTimerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(document.createElement("div"))

  const inExecution: boolean = state?.execute === true
  const inPlanning: boolean = state?.execute !== true

  const hideDone = state?.hideDone === true

  function renderTimerToRef(ref: RefObject<HTMLDivElement>, timer: Timer | null) {
    ref.current && (ref.current.innerHTML = renderToString(timerContent(timer)))
  }

  useEffect(() => {
    if (state?.execute !== true) return () => { }
    const id = setInterval(() => { renderTimerToRef(totalTimerRef, globalTimer); renderTimerToRef(localTimerRef, localTimer) }, 45.33)
    return () => clearInterval(id)
  }, [items, current, globalTimer, timers, state?.execute])

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
    if (current < timers.length) {
      if (inPlanning && localTimer?.kind !== 'stopped') modifyTimer('stop')
    }
  }, [items, current, timers, inExecution])

  // ocne we have structured items, this should be easier to write
  function itemLongRunning(index: number, now: number): boolean {
    const t = timers && timers[index]
    return !t || timerLength(t, now) > 90
  }

  function seekCurrent(
    current: number,
    advance: number,
    lineCount: number,
    hideDone: boolean,
    items: RenderLine[],
  ): number {
    if (hideDone) {
      const now = Date.now()
      let recursionGuard = 500

      while (hideDone && Math.abs(advance) == 1 && (current >= 0 && current < lineCount) && recursionGuard-- > 0) {
        current += advance
        const longRunning = itemLongRunning(current, now)
        const separator = items[current]?.separator
        const skipped = separator || longRunning
        if (!skipped) break
      }

      advance = 0
    }

    return Math.max(0, Math.min(current + advance, lineCount - 1))
  }

  function newAndRecalculate(a: Args) {
    setState((s: RState | undefined) => {
      const contentsOr = a.contents === '' ? a.contents : (a.contents || state?.text || '')
      const execute = a.execute === undefined ? state?.execute : a.execute
      const hideDone = a.hideDone === undefined ? state?.hideDone : a.hideDone

      let items: RenderLine[] = (s?.items_ || [])
      let newMemory: Memory | undefined = undefined
      let nextTimers: Timers | undefined = undefined
      let nextTotalTimer: Timer | undefined = state?.totalTimer

      if (a.eval) {
        const oldMemory = (state?.memory && mapParse(state.memory)) || new Map()
        // console.clear()
        const [lines, memory] = evalContentsMem(contentsOr, oldMemory)
        newMemory = memory
        items = lines
        nextTotalTimer = undefined
        nextTimers = lines.map(_ => null)
      }

      const nextItems = items === undefined ? s?.items_ : items
      const lineCount = items.length

      const savedMemory = newMemory !== undefined ? { nextMemory: mapSerialize(newMemory) } : {}
      const nextMemory = ((s?.nextMemory && a.save) ? { memory: s?.nextMemory, nextMemory: undefined } : {})

      const nextCurrent = seekCurrent(s?.current || 0, a.advance || 0, lineCount, hideDone, items)

      return {
        ...s,
        text: contentsOr,

        items_: nextItems,
        outLineCount: lineCount,
        ...savedMemory,
        ...nextMemory,

        execute: execute,
        current: a.eval ? 0 : nextCurrent,
        hideDone: hideDone,
        totalTimer: nextTotalTimer,
        timers: nextTimers || timers,
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
        timers: (s.timers || []).map((timer, index) => {
          return modifyTimerPure(timer, index == s?.current ? command : 'stop', now)
        })
      }
    })
  }

  function timerContent(timer: Timer | null): string {
    const formatted = (timer: Timer) => padRight(ms(timerLength(timer, Date.now())), 10, ' ')
    return (timer && (formatted(timer))) || ''
  }

  function planningControlButtons(): JSX.Element {
    return <>
      <a className="pr-3 select-none" style={state?.nextMemory ? {} : { opacity: '50%' }} onClick={() => newAndRecalculate({ save: true })}>💾</a>
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

  function executionItems(): JSX.Element {
    const show = directRange(-2, 2)

    return <div className="w-full flex flex-col flex-grow justify-center select-none">
      {show.map(s => s + current).map(index =>
        <div key={index} className="w-full text-center text-wrap" style={index == current ? { fontSize: '2rem' } : { color: '#bbb' }}>
          {items[index]?.contents}
        </div>
      )}
    </div>
  }

  function executionStats(): JSX.Element {
    const timerControls = <>
      <span onClick={() => modifyTimer(localTimer?.running ? 'stop' : 'start')} className="pt-3 pb-3 pl-2 pr-2 select-none">{localTimer?.running ? '⏸️' : '▶️'}</span>
      <span onClick={() => modifyTimer('restart', 'local')} className="pt-3 pb-3 pl-2 pr-2 select-none">🔄</span>
    </>

    return <div className="w-full pb-2 text-center font-mono">
      <div className="text-[#888]">{current + 1}/{outLineCount}</div>

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

// TODO: lang: mark blocks that must require keyified items only

// TODO: execution: a view for the rendered program
// TODO: execution: show contents in a split view (renderProgram as a function from the App.tsx)
// TODO: execution: can update tasks (comments, params) (blocker: required that the list is actually just a list of indexes, not items themselves)
// TODO: execution: [] must remain parsable, to show current item, so the item must instead be structured (with render to string)
// TODO: execution: memory impact only per-item
// TODO: execution: scrollable execution items
// TODO: execution: render blocks as distinct, so you could rerandomize whole blocks

// TODO: interpret: make sure that eval gets a new scope, not window, so it could be wiped between rerandomization (comlink)
// TODO: interpret: 2x = (1/2) + (2/2) (combine with execution mode: the view is just an index of the item + some decoration)
// TODO: interpret: either text-blocks or text-only line syntax
// TODO: interpret: use fancy <> for rendering to string, so that it can simply be taken in as a text line, if reinterpreted

// TODO: util: if an item is rendered, but not included in a main block, it impacts the memory
// TODO: util: the save button should save the memory from the current rendered content
// TODO: util: cross inside utils with cross on generic arrays + https://www.npmjs.com/package/string-format

// TODO: scheduling: memory gets wiped, if a keyed slot has more options, because the technical key is key+(items.join)
// TODO: scheduling: commit task memory only in execution (problem: multiple transactions in the same program per different items)
// TODO: scheduling: give "gas" to tasks, so they get temporarily bumped
// TODO: scheduling: check that scheduleBlocks picks from all tasks, if there are multiples
// TODO: scheduling: scheduleBlocks: don't touch memory, just sort by queue

// TODO: content: make programmable scales
// TODO: content: random note while inside position
// TODO: content: bow articulations tasks
// TODO: content: maybeEvery derived from memory (make it work on indices)
// TODO: content: sequence of bow spots until 1/8th resolution with bowing directions
