import { mapParse, mapSerialize } from '../lib/Map.js'
import { evalContentsMem } from './RandomizeLang.js'
import murmur from 'murmurhash3js'

function hm(m: number): string {
  return `${Math.floor(m / 60)}h${m % 60}`
}

function Randomize(controls: any) {
  const { state, setState } = controls

  const distance = state?.distance || 0

  function newAndRecalculate(a: { contents?: string, distance?: string, save?: boolean }) {
    setState(s => {
      const contentsOr = a.contents === '' ? a.contents : (a.contents || state?.text || '')
      const distanceOr = parseInt(a.distance || distance)

      const oldMemory = (state?.memory && mapParse(state.memory)) || new Map()
      // console.clear()
      const [lines, memory] = evalContentsMem(contentsOr, oldMemory)
      const output = lines.join('\n')
      const outLineCount = output.split('\n').filter(a => a !== '---').length

      const savedMemory = a.save ? { memory: mapSerialize(memory) } : {}

      return {
        ...s, text: contentsOr, distance: distanceOr, output, ...savedMemory, outLineCount
      }
    })
  }

  return (
    <div className="w-full">
      { /* <div className="pl-[10px]">
        min distance: <input type="number" onChange={e => newAndRecalculate({distance: e.target.value})} className="border" min="0" max="10" placeholder={distance} />
      </div> */ }

      <div className="pl-[10px]">
        <a className="pr-3" onClick={() => newAndRecalculate({ save: true })}>💾</a>
        <a className="pr-3" onClick={() => newAndRecalculate({})}>🔄</a>
        <a className="pr-3" onClick={() => newAndRecalculate({ contents: '' })}>❌{/* right now this breaks history of textarea */}</a>
        <span className="pr-3">
          {state?.outLineCount ? <>{state?.outLineCount} * 4min = {hm(state.outLineCount * 4)}</> : <></>}
        </span>
        <span className="pr-3 text-[#f4f4f4]">
          {state.memory && Math.abs(murmur.x86.hash32(state.memory)) % 10000}
        </span>
      </div>

      <div className="w-full flex flex-row selection:red text-sm">
        <div className="grow p-[10px]">
          <textarea className="block w-full p-[5px] border" rows={35} cols={130} onChange={e => newAndRecalculate({ contents: e.target.value })} value={state?.text}></textarea>
        </div>

        <div className="grow p-[10px]">
          <textarea className="block w-full p-[5px] border font-mono" rows={35} cols={130} value={state?.output} readOnly></textarea>
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

// TODO: ui: save button just saves, but doesn't refresh

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
