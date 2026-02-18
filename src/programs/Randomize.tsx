import { renderToString } from 'react-dom/server'
import { mapParse, mapSerialize } from '../lib/Map.js'
import { evalContentsMem, Memory } from './RandomizeLang.js'
import murmur from 'murmurhash3js'
import { clone } from 'lodash'
import { roundToNaive } from '../lib/Math.js'
import { JSX, RefObject, useEffect, useRef } from 'react'

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
  const m = Math.floor(a / 60)
  const s = roundToNaive(a % 60, 2).toFixed(2)
  return pad(m == 0 ? `${s}s` : `${m}m${s}`, 10, ' ')
}

type RState = {
  text?: string,
  distance?: number,

  output?: string,
  outLineCount?: number,
  memory?: string,
  nextMemory?: string,

  execute: boolean,
  current?: number,
  timers?: Timers,
}

type Timer = { kind: 'started', start: number, running: true } | { kind: 'stopped', length: number, running: false }
type Timers = (Timer | null)[]

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
  distance?: string,
  save?: boolean,
  execute?: boolean,
  advance?: number,
}


function Randomize(controls: any): JSX.Element {
  const { state, setState, advanceRef } = controls

  const distance = state?.distance || 0
  const current = state?.current || 0
  const timers: Timers = state?.timers || []

  const output: string = state?.output || ''
  const outLineCount: number = state?.outLineCount || 0

  const items = (state?.output || '').split('\n')
  const show = [-1, 0, 1]
  const timer = timers[current]
  const timerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(document.createElement("div"))

  useEffect(() => {
    if (state?.execute !== true) return () => { }
    const id = setInterval(() => { timerRef.current && (timerRef.current.innerHTML = renderToString(timerContent())) }, 45.33)
    return () => clearInterval(id)
  }, [output, current, timers, state?.execute])

  advanceRef.current = (advance: MouseEvent | null, _event: any) => {
    const advanceDir = (advance?.target as HTMLElement)?.className
    const advanceDelta =
      advanceDir == 'next'
        ? 1
        : advanceDir == 'prev'
          ? -1 :
          advance ? 1 : 0

    // if (Math.abs(advanceDelta) == 1 && current + 1 == outLineCount) newAndRecalculate({ eval: true })
    if (Math.abs(advanceDelta) == 1) newAndRecalculate({ advance: advanceDelta })
  }

  useEffect(() => {
    if (current < timers.length && !timers[current]) startTimer()
  }, [output, current, timers])

  function newAndRecalculate(a: Args) {
    setState((s: RState | undefined) => {
      const contentsOr = a.contents === '' ? a.contents : (a.contents || state?.text || '')
      const distanceOr = parseInt(a.distance || distance)
      const execute = a.execute === undefined ? state?.execute : a.execute

      let output = (s?.output || '')
      let newMemory: Memory | undefined = undefined
      let nextTimers: Timers | undefined = undefined

      console.log(timers)
      if (a.eval) {
        const oldMemory = (state?.memory && mapParse(state.memory)) || new Map()
        // console.clear()
        const [lines, memory] = evalContentsMem(contentsOr, oldMemory)
        newMemory = memory
        output = lines.join('\n')
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
        distance: distanceOr,

        output: nextOutput,
        outLineCount: lineCount,
        ...savedMemory,
        ...nextMemory,

        execute: execute,
        current: a.eval ? 0 : nextCurrent,
        timers: nextTimers || timers,
      } satisfies RState
    })
  }

  function startTimer(restart: boolean = false) {
    setState((s: RState | undefined) => {
      if (!s) return s

      const ts = clone(timers)
      console.log({ timer, current })
      const newTimer = (!timers[current] || restart) ? freshTimer(Date.now()) : toStartedTimer(timers[current], Date.now())
      ts.splice(current, 1, newTimer)
      return { ...s, timers: ts }
    })
  }

  function stopTimer() {
    setState((s: RState | undefined) => {
      if (!s) return s
      if (!timers[current]) return s

      const ts = clone(timers)
      ts.splice(current, 1, toStoppedTimer(timers[current], Date.now()))
      return { ...s, timers: ts }
    })
  }

  function timerContent(): string {
    return (timer && (ms(timerLength(timer, Date.now())))) || ''
  }

  return (
    <div className="w-full">
      { /* <div className="pl-[10px]">
        min distance: <input type="number" onChange={e => newAndRecalculate({distance: e.target.value})} className="border" min="0" max="10" placeholder={distance} />
      </div> */ }

      <div className="pl-[10px]">
        <a className="pr-3" onClick={() => newAndRecalculate({ execute: !state?.execute })}>{state?.execute ? '⏸️' : '▶️'}</a>
        <a className="pr-3" style={state?.nextMemory ? {} : { opacity: '50%' }} onClick={() => newAndRecalculate({ save: true })}>💾</a>
        <a className="pr-3" onClick={() => newAndRecalculate({ eval: true, })}>🔄</a>
        <a className="pr-3" onClick={() => confirm('delete?') && newAndRecalculate({ eval: true, contents: '', execute: false })}>❌{/* right now this breaks history of textarea */}</a>

        <span className="pr-3">
          {state?.outLineCount ? <>{state?.outLineCount} * 4min = {hm(state.outLineCount * 4)}</> : <></>}
        </span>
        <span className="pr-3 text-[#f4f4f4]">
          {state?.memory && Math.abs(murmur.x86.hash32(state.memory)) % 10000}
        </span>
      </div>

      <div className={"w-[100dvwh] flex flex-row selection:red text-sm " + (state?.execute ? 'hidden' : '')} style={({ height: "calc(90dvh - 4rem)" })}>
        <div className="grow p-[10px]">
          <textarea className="block w-full h-full p-[5px] border" cols={130} onChange={e => newAndRecalculate({ contents: e.target.value, eval: true })} value={state?.text}></textarea>
        </div>

        <div className="grow p-[10px]">
          <textarea className="block w-full h-full p-[5px] border font-mono" cols={130} value={state?.output} readOnly></textarea>
        </div>
      </div>

      <div className={"w-[100dvw] flex flex-col justfiy-center " + (!state?.execute ? 'hidden' : '')} style={({ height: "calc(90dvh - 4rem)" })}>
        <div className="w-full text-center pb-2 text-center">
          <div className="text-[#888]">{current + 1} / {outLineCount}</div>

          <div className="font-mono">
            <span className="p-3" ref={timerRef}></span>
            {timer && <span onClick={() => timer.running ? stopTimer() : startTimer(false)} className="p-3">{timer.running ? '⏸️' : '▶️'}</span>}
            <span onClick={() => startTimer(true)} className="p-3">🔄</span>
          </div>
        </div>

        <div className="w-full flex flex-col flex-grow justify-center">
          {show.map(s => s + current).map(index =>
            <div key={index} className="w-full text-center text-wrap" style={index == current ? { fontSize: '4rem' } : { color: '#bbb' }}>{items[index]}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Randomize

// TODO: execution: a view for the rendered program
// TODO: execution: show contents in a split view (renderProgram as a function from the App.tsx)
// TODO: execution: can update tasks (comments, params) (blocker: required that the list is actually just a list of indexes, not items themselves)
// TODO: execution: [] must remain parsable, to show current item, so the item must instead be structured (with render to string)
// TODO: execution: memory impact only per-item

// TODO: interpret: make sure that eval gets a new scope, not window, so it could be wiped between rerandomization (comlink)
// TODO: interpret: 2x = (1/2) + (2/2) (combine with execution mode: the view is just an index of the item + some decoration)
// TODO: interpret: either text-blocks or text-only line syntax
// TODO: interpret: use fancy <> for rendering to string, so that it can simply be taken in as a text line, if reinterpreted

// TODO: util: if an item is rendered, but not included in a main block, it impacts the memory
// TODO: util: the save button should save the memory from the current rendered content

// TODO: scheduling: memory gets wiped, if a keyed slot has more options, because the technical key is key+(items.join)
// TODO: scheduling: commit task memory only in execution (problem: multiple transactions in the same program per different items)
// TODO: scheduling: give "gas" to tasks, so they get temporarily bumped

// TODO content: write a task selection picker without refering to the contents (I have no idea what this means any more)
// TODO content: make programmable scales
// TODO content: random note while inside position
// TODO content: bow articulations tasks
// TODO content: maybeEvery derived from memory (make it work on indices)
