import { evalContents } from './RandomizeLang.js'

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

      const output = evalContents(contentsOr).join('\n')
      const outLineCount = output.split('\n').filter(a => a !== '---').length

      return {
        ...s, text: contentsOr, distance: distanceOr, output: output, outLineCount
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
          { state?.outLineCount ? <>{state?.outLineCount} * 4min = {hm(state.outLineCount * 4)}</> : <></> }
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

// TODO: lang: allow escaping brackets inside brackets
// TODO: 2x = (1/2) + (2/2) (requires another pass over block after shuffling)
//
// TODO: util: add statistics for s(``)
// TODO: util: progress(startDate, endDate) = percentage% [0, 100]%
// TODO: util: maybeReverse

// TODO content: pieces into their own lists, extract portions into the main, basically a fully-fledged program

// TODO: make programmable scales
