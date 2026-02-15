import { mapParse, mapSerialize } from '../lib/Map.js'
import { evalContentsMem, Memory } from './RandomizeLang.js'
import murmur from 'murmurhash3js'

function hm(m: number): string {
  return `${Math.floor(m / 60)}h${m % 60}`
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
}

type Args = {
  eval?: boolean,
  contents?: string,
  distance?: string,
  save?: boolean,
  execute?: boolean,
  advance?: number,
}


function Randomize(controls: any) {
  const { state, setState, advance } = controls

  const advanceDir = advance?.target?.className
  const advanceDelta = advance === true ? 1 : advanceDir == 'next' ? 1 : advanceDir == 'prev' ? -1 : 0

  const distance = state?.distance || 0
  const current = state?.current || 0

  function newAndRecalculate(a: Args) {
    setState((s: RState | undefined) => {
      const contentsOr = a.contents === '' ? a.contents : (a.contents || state?.text || '')
      const distanceOr = parseInt(a.distance || distance)
      const execute = a.execute === undefined ? state?.execute : a.execute

      let output = (s?.output || '')
      let newMemory: Memory | undefined = undefined

      if (a.eval) {
        const oldMemory = (state?.memory && mapParse(state.memory)) || new Map()
        // console.clear()
        const [lines, memory] = evalContentsMem(contentsOr, oldMemory)
        newMemory = memory
        output = lines.join('\n')
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
      } satisfies RState
    })
  }

  if (Math.abs(advanceDelta) == 1) newAndRecalculate({ advance: advanceDelta })

  const items = (state?.output || '').split('\n')
  const show = [-1, 0, 1]

  return (
    <div className="w-full">
      { /* <div className="pl-[10px]">
        min distance: <input type="number" onChange={e => newAndRecalculate({distance: e.target.value})} className="border" min="0" max="10" placeholder={distance} />
      </div> */ }

      <div className="pl-[10px]">
        <a className="pr-3" onClick={() => newAndRecalculate({ execute: !state.execute })}>{state?.execute ? '⏸️' : '▶️'}</a>
        <a className="pr-3" style={state?.nextMemory ? {} : { opacity: '50%' }} onClick={() => newAndRecalculate({ save: true })}>💾</a>
        <a className="pr-3" onClick={() => newAndRecalculate({ eval: true, })}>🔄</a>
        <a className="pr-3" onClick={() => newAndRecalculate({ eval: true, contents: '' })}>❌{/* right now this breaks history of textarea */}</a>

        <span className="pr-3">
          {state?.outLineCount ? <>{state?.outLineCount} * 4min = {hm(state.outLineCount * 4)}</> : <></>}
        </span>
        <span className="pr-3 text-[#f4f4f4]">
          {state.memory && Math.abs(murmur.x86.hash32(state.memory)) % 10000}
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
        <div className="w-full text-center color-[#888] pb-2 text-center">{current + 1} / {state?.outLineCount}</div>

        <div className="w-full flex flex-col flex-grow justify-center">

          {show.map(s => s + current).map(index =>
            <div key={index} className="w-full text-center" style={index == current ? { fontSize: '4rem' } : { color: '#bbb' }}>{items[index]}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Randomize

// TODO: execution: a view for the rendered program
// TODO: execution: show contents in a split view (renderProgram as a function from the App.tsx)
// TODO: execution: phone view
// TODO: execution: can update tasks (comments, params) (blocker: required that the list is actually just a list of indexes, not items themselves)
// TODO: execution: time tracker
// TODO: execution: [] must remain parsable, to show current item, so the item must instead be structured (with render to string)

// TODO: interpret: make sure that eval gets a new scope, not window, so it could be wiped between rerandomization (comlink)
// TODO: interpret: allow escaping brackets inside brackets
// TODO: interpret: 2x = (1/2) + (2/2) (combine with execution mode: the view is just an index of the item + some decoration)
// TODO: interpret: either text-blocks or text-only line syntax
// TODO: interpret: use fancy <> for rendering to string, so that it can simply be taken in as a text line, if reinterpreted

// TODO: util: schedule doesn't respect
// TODO: util: if an item doesn't get fulfilled, it still impacted the memory
// TODO: util: if an item is rendered, but not included in a main block, it impacts the memory
// TODO: util: the save button should save the memory from the current rendered content

// TODO: scheduling: memory gets wiped, if a keyed slot has more options, because the technical key is key+(items.join)
// TODO: scheduling: commit task memory only in execution (problem: multiple transactions in the same program per different items)
// TODO: scheduling: give "gas" to tasks, so they get temporarily bumped
// TODO: scheduling: store not "times picked", but order of last picked
// TODO: scheduling: after() function to ban certain exercises

// TODO content: write a task selection picker without refering to the contents (I have no idea what this means any more)
// TODO content: make programmable scales
// TODO content: random note while inside position
// TODO content: bow articulations tasks
// TODO content: maybeEvery derived from memory (make it work on indices)
