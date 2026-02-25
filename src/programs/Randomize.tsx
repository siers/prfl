import { renderToString } from 'react-dom/server'
import { mapParse, mapSerialize } from '../lib/Map.js'
import { evalContentsMem, Memory } from './RandomizeLang.js'
import murmur from 'murmurhash3js'
import { roundToNaive } from '../lib/Math.js'
import { JSX, RefObject, useEffect, useRef } from 'react'
import { directRange } from '../lib/Array.js'

function pad(str: string, size: number, with_: string): string {
  var s = str
  while (s.length < size) s = with_ + s
  return s
}

function hm(a: number): string {
  const h = Math.floor(a / 60)
  const m = roundToNaive(a % 60, 2)
  return h == 0 ? `${m}m` : `${h}h${m}`
}

function ms(a: number): string {
  const h = Math.floor(a / 3600)
  const m = Math.floor((a / 60) % 60)
  const s = roundToNaive(a % 60, 2).toFixed(2)
  return pad(h != 0 ? `${h}h${m}m${s}` : m != 0 ? `${m}m${s}` : `${s}s`, 10, ' ')
}

type RState = {
  text?: string,

  output?: string,
  outLineCount?: number,
  memory?: string,
  nextMemory?: string,

  execute: boolean,
  current?: number,
  totalTimer?: Timer,
  timers?: Timers,
}

type Timer = { kind: 'started', start: number, running: true } | { kind: 'stopped', length: number, running: false }
type Timers = (Timer | null)[]
type TimerCommand = 'start' | 'stop' | 'restart' | 'local-as-global'

const freshTimer: (start: number) => Timer = (start: number) => ({ kind: 'started', start, running: true })
const toStoppedTimer: (t: Timer, stop: number) => Timer = (t: Timer, stop: number) => {
  if (t.kind == 'stopped') return t
  if (t.kind == 'started') return ({ kind: 'stopped', length: stop - t.start, running: false })
  return freshTimer(0) // t.kind is `never` here
}
const toStartedTimer: (t: Timer, start: number) => Timer = (t: Timer, start: number) => {
  if (t.kind == 'started') return t
  if (t.kind == 'stopped') return freshTimer(start - t.length)
  return freshTimer(0) // t.kind is `never` here
}

function timerLength(t: Timer, now: number): number {
  if (t.kind == 'started') return (now - t.start) / 1000
  if (t.kind == 'stopped') return t.length / 1000
  return 0
}

type Args = {
  eval?: boolean,
  contents?: string,
  save?: boolean,
  execute?: boolean,
  advance?: number,
}


function Randomize(controls: any): JSX.Element {
  const { state, setState, advanceRef } = controls

  const current = state?.current || 0
  const timers: Timers = state?.timers || []

  const output: string = state?.output || ''
  const outLineCount: number = state?.outLineCount || 0

  const items = (state?.output || '').split('\n')
  const globalTimer = state?.totalTimer
  const localTimer = timers[current]
  const localTimerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(document.createElement("div"))
  const totalTimerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(document.createElement("div"))

  const inExecution: boolean = state?.execute === true
  const inPlanning: boolean = state?.execute !== true

  function renderTimerToRef(ref: RefObject<HTMLDivElement>, timer: Timer | null) {
    ref.current && (ref.current.innerHTML = renderToString(timerContent(timer)))
  }

  useEffect(() => {
    if (state?.execute !== true) return () => { }
    const id = setInterval(() => { renderTimerToRef(totalTimerRef, globalTimer); renderTimerToRef(localTimerRef, localTimer) }, 45.33)
    return () => clearInterval(id)
  }, [output, current, globalTimer, timers, state?.execute])

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
  }, [output, current, timers, inExecution])

  function newAndRecalculate(a: Args) {
    setState((s: RState | undefined) => {
      const contentsOr = a.contents === '' ? a.contents : (a.contents || state?.text || '')
      const execute = a.execute === undefined ? state?.execute : a.execute

      let output = (s?.output || '')
      let newMemory: Memory | undefined = undefined
      let nextTimers: Timers | undefined = undefined
      let nextTotalTimer: Timer | undefined = state?.totalTimer

      if (a.eval) {
        const oldMemory = (state?.memory && mapParse(state.memory)) || new Map()
        // console.clear()
        const [lines, memory] = evalContentsMem(contentsOr, oldMemory)
        newMemory = memory
        output = lines.join('\n')
        nextTotalTimer = undefined
        nextTimers = lines.map(_ => null)
      }

      const nextOutput = output === undefined ? s?.output : output
      const lineCount = output.split('\n').length

      const savedMemory = newMemory !== undefined ? { nextMemory: mapSerialize(newMemory) } : {}
      const nextMemory = ((s?.nextMemory && a.save) ? { memory: s?.nextMemory, nextMemory: undefined } : {})

      const nextCurrent = Math.max(0, Math.min((s?.current || 0) + (a.advance || 0), lineCount - 1))

      return {
        ...s,
        text: contentsOr,

        output: nextOutput,
        outLineCount: lineCount,
        ...savedMemory,
        ...nextMemory,

        execute: execute,
        current: a.eval ? 0 : nextCurrent,
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
      return (!t || command == 'restart') ? freshTimer(now) : toStartedTimer(t, now)
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
    return (timer && (ms(timerLength(timer, Date.now())))) || ''
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

  function editor(): JSX.Element {
    return <div className={"w-[100dvwh] flex flex-row selection:red text-sm "} style={({ height: "calc(90dvh)" })}>
      <div className="grow p-[10px]">
        <textarea className="block w-full h-full p-[5px] border" cols={130} onChange={e => newAndRecalculate({ contents: e.target.value, eval: true })} value={state?.text}></textarea>
      </div>

      <div className="grow p-[10px]">
        <textarea className="block w-full h-full p-[5px] border font-mono" cols={130} value={state?.output} readOnly></textarea>
      </div>
    </div>
  }

  function executionItems(): JSX.Element {
    const show = directRange(-2, 2)

    return <div className="w-full flex flex-col flex-grow justify-center">
      {show.map(s => s + current).map(index =>
        <div key={index} className="w-full text-center text-wrap" style={index == current ? { fontSize: '2rem' } : { color: '#bbb' }}>{items[index]}</div>
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

// TODO: execution: a view for the rendered program
// TODO: execution: show contents in a split view (renderProgram as a function from the App.tsx)
// TODO: execution: can update tasks (comments, params) (blocker: required that the list is actually just a list of indexes, not items themselves)
// TODO: execution: [] must remain parsable, to show current item, so the item must instead be structured (with render to string)
// TODO: execution: memory impact only per-item
// TODO: execution: scrollable execution items

// TODO: interpret: make sure that eval gets a new scope, not window, so it could be wiped between rerandomization (comlink)
// TODO: interpret: 2x = (1/2) + (2/2) (combine with execution mode: the view is just an index of the item + some decoration)
// TODO: interpret: either text-blocks or text-only line syntax
// TODO: interpret: use fancy <> for rendering to string, so that it can simply be taken in as a text line, if reinterpreted

// TODO: util: if an item is rendered, but not included in a main block, it impacts the memory
// TODO: util: the save button should save the memory from the current rendered content
// TODO: util: scheduleBlocks syntax for pyramidPhrases.map

// TODO: scheduling: memory gets wiped, if a keyed slot has more options, because the technical key is key+(items.join)
// TODO: scheduling: commit task memory only in execution (problem: multiple transactions in the same program per different items)
// TODO: scheduling: give "gas" to tasks, so they get temporarily bumped
// TODO: scheduling: check that scheduleBlocks picks from all tasks, if there are multiples

// TODO: content: write a task selection picker without refering to the contents (I have no idea what this means any more)
// TODO: content: make programmable scales
// TODO: content: random note while inside position
// TODO: content: bow articulations tasks
// TODO: content: maybeEvery derived from memory (make it work on indices)
