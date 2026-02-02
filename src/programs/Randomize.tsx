import { mapParse, mapSerialize } from '../lib/Map.js'
import { evalContentsMem } from './RandomizeLang.js'

function hm(m: number): string {
  return `${Math.floor(m / 60)}h${m % 60}`
}

function Randomize(controls: any) {
  const { state, setState } = controls

  const distance = state?.distance || 0

  function newAndRecalculate(newContents: string | null = null, newDistance: string | null = null) {
    setState(s => {
      const contentsOr = newContents === '' ? newContents : (newContents || state?.text || '')
      const distanceOr = parseInt(newDistance || distance)

      const oldMemory = (state?.memory && mapParse(state.memory)) || new Map()
      const [lines, memory] = evalContentsMem(contentsOr, oldMemory)
      const output = lines.join('\n')
      const outLineCount = output.split('\n').filter(a => a !== '---').length

      return {
        ...s, text: contentsOr, distance: distanceOr, output, memory: mapSerialize(memory), outLineCount
      }
    })
  }

  return (
    <div className="">
      { /* <div className="pl-[10px]">
        min distance: <input type="number" onChange={e => newAndRecalculate(null, e.target.value)} className="border" min="0" max="10" placeholder={distance} />
      </div> */ }

      <div className="flex flex-row selection:red text-sm">
        <div className="grow p-[10px]">
          <textarea className="p-[5px] border" rows={20} cols={50} onChange={e => newAndRecalculate(e.target.value, null)} value={state?.text}></textarea>
        </div>

        <div className="grow p-[10px]">
          <textarea className="p-[5px] border font-mono" rows={20} cols={50} value={state?.output} readOnly></textarea>
        </div>
      </div>

      <div className="pl-[10px]">
        <a className="pr-3" onClick={() => newAndRecalculate()}>🔄</a>
        <a className="pr-3" onClick={() => newAndRecalculate('')}>❌{/* right now this breaks history of textarea */}</a>
        <span className="pr-3">
          {state?.outLineCount ? <>{state?.outLineCount} * 4min = {hm(state.outLineCount * 4)}</> : <></>}
        </span>
      </div>
    </div>
  )
}

export default Randomize

// TODO: execution view for the rendered program
// TODO: time tracker & adding comments to update the original item
// TODO: renderProgram as a function from the App.tsx
// TODO: phone view for the execution program
// TODO: execution view can update tasks, blocker: required that the list is actually just a list of indexes, not items themselves
// TODO: execution view: [] must remain parsable, to show current item, so the item must instead be structured (with render to string)

// TODO: interpret: make sure that eval gets a new scope, not window, so it could be wiped between rerandomization
// TODO: interpret: allow escaping brackets inside brackets
// TODO: interpret: 2x = (1/2) + (2/2) (requires another pass over block after shuffling)
// TODO: interpret: either text-blocks or text-only line syntax
// TODO: interpret: use fancy <> for rendering to string, so that it can simply be taken in as a text line, if reinterpreted

// TODO: util: add statistics for s(``), blocker: memory needed to feed back into react state, gotta look out for overclearing
// TODO: util: maybeReverse
// TODO: util: partChunksShuf offsets fucked
// TODO: util: parts choices for formatting, because neither option always works (10%, 1/10, 1)

// TODO content: make programmable scales
// TODO content: write chromatic slide exercise instrunctions
// TODO content: stringPositions() { return string x position.map(sp = note) }, then quiz self on execution view
// TODO content: random note while inside position
// TODO ToneLib: uses for modelling the violin fingerboard: finding first inversion of a chord for programming chromatic slides
