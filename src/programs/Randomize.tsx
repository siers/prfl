import { shuffleArray, shuffleMinDistance, shuffleMinDistanceIndexed } from '../lib/Random'
import { evalContents } from './RandomizeLang.js'

function Randomize(controls: any) {
  const { state, setState } = controls

  const distance = state?.distance || 0

  function newAndRecalculate(newContents: string | null = null, newDistance: string | null = null) {
    setState(s => {
      const contentsOr = newContents === '' ? newContents : (newContents || state?.text || '')
      const distanceOr = parseInt(newDistance || distance)

      const output = evalContents(contentsOr).join('\n')

      return { ...s, text: contentsOr, distance: distanceOr, output: output }
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
        <a onClick={() => newAndRecalculate()}>🔄</a> <a onClick={() => newAndRecalculate('')}>❌{/* right now this breaks history of textarea */}</a>
      </div>
    </div>
  )
}

export default Randomize

// TODO: chunk the whole per 10
// TODO: turing complete templating with predefined combo functions
// Lang: chunking per piece
// Lang: {} shouldn't be parsed within [], add parser combinators
// TODO: make programmable scales
// TODO: make the list loadable on a splitscreen
// TODO: 2x = (1/2) + (2/2)

// TODO: make brackets evaluate actual javascript, [] is inline list, {} is jq style '.[] inversion'
// TODO: brackets: enable combinatorial functions (mirrors, repetitions, splits)
// TODO: named lists
// TODO: feed into flash
// TODO: repetition, interleaving functions
