import { shuffleArray, shuffleMinDistance, shuffleMinDistanceIndexed } from '../lib/Random'
import { times } from '../lib/Array'
import { parseContents } from './RandomizeLang.js'


function Randomize(controls) {
  const {state, setState, advance} = controls

  const distance = state?.distance || 0

  function theShuffle(lines, distance) {
    return shuffleMinDistanceIndexed(lines, distance)
  }

  function newAndRecalculate(newContents, newDistance) {
    setState(s => {
      const contentsOr = newContents === '' ? newContents : (newContents || state?.text || '')
      const distanceOr = parseInt(newDistance || distance)

      const parsed = parseContents(contentsOr)
      const output = theShuffle(parsed, distanceOr).join('\n')

      return {...s, text: contentsOr, distance: distanceOr, output: output}
    })
  }

  return (
    <div className="">
      <div className="pl-[10px]">
        min distance: <input type="number" onChange={e => newAndRecalculate(null, e.target.value)} className="border" min="0" max="10" placeholder={distance} />
      </div>

      <div className="flex flex-row selection:red text-sm">
        <div className="grow p-[10px]">
          <textarea className="p-[5px] border" rows="20" cols="50" onChange={e => newAndRecalculate(e.target.value, null)} value={state?.text}></textarea>
        </div>

        <div className="grow p-[10px]">
          <textarea className="p-[5px] border font-mono" rows="20" cols="50" value={state?.output} readOnly></textarea>
        </div>
      </div>

      <div className="pl-[10px]">
        <a onClick={() => newAndRecalculate()}>🔄</a> <a onClick={() => newAndRecalculate('')}>❌{/* right now this breaks history of textarea */}</a>
      </div>
    </div>
  )
}

export default Randomize
