import ToneLib from '../lib/ToneLib'
import { shuffleArray, shuffleMinDistance } from '../lib/Random'
import { prepareNext, select } from '../lib/Program'
import { chunk } from '../lib/Array'
import { times } from '../lib/Array'

// multiplies lines if they have "3x" in front of them
// bug: breaks the shuffler, perhaps something's ill defined
// function parseContents(lines) {
//   return lines.flatMap((line, index) => {
//     const match = line.match(/^(\d+)x (.*)$/)

//     if (match) {
//       const [_, n, title] = match
//       return times(parseInt(n)).map(_ => [index, title])
//     } else
//       return [[index, line]]
//   })
// }

function Randomize(controls) {
  const {state, setState, advance} = controls

  const distance = state?.distance || 2

  function newAndRecalculate(newContents, newDistance) {
    setState(s => {
      const contentsOr = newContents === '' ? newContents : (newContents || state?.text || '')
      const distanceOr = parseInt(newDistance || distance)
      const textLinesIndexed = contentsOr.split('\n').filter(x => !x.match(/^ *$/))
      const output = shuffleMinDistance(textLinesIndexed, distanceOr).join('\n')

      return {...s, text: contentsOr, distance: distanceOr, output: output}
    })
  }

  return (
    <div className="">
      <div className="pl-[10px]">
        min distance: <input type="number" onChange={e => newAndRecalculate(null, e.target.value)} min="0" max="100" className="border" value={distance} />
      </div>

      <div className="flex flex-row selection:red text-sm">
        <div className="grow p-[10px]">
          <textarea className="p-[5px] border" rows="20" cols="50" onChange={e => newAndRecalculate(e.target.value, null)} value={state?.text}></textarea>
        </div>

        <div className="grow p-[10px]">
          <textarea className="p-[5px] border" rows="20" cols="50" value={state?.output} readOnly></textarea>
        </div>
      </div>

      <div className="pl-[10px]">
        <a onClick={() => newAndRecalculate()}>🔄</a> <a onClick={() => newAndRecalculate('')}>❌{/* right now this breaks history of textarea */}</a>
      </div>
    </div>
  )
}

export default Randomize
