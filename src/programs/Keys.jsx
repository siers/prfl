import ToneLib from '../lib/ToneLib'
import { shuffleArray } from '../lib/Random'

function chunks(arr, len) {
  var chunks = [], i = 0, n = arr.length;
  while (i < n) chunks.push(arr.slice(i, i += len))
  return chunks
}

function prepareNext(controls, makeData) {
  const {state, setState, advance} = controls

  if ((state?.next?.length || 0) < 1) {
    setState(state => ({...state, next: makeData()}))
  }

  if (advance && state?.next) {
    const [, ...remaining] = state?.next
    setState(state => ({...state, next: remaining}))
  }
}

function Keys(controls) {
  const makeData = () => chunks(shuffleArray((new ToneLib).keysMajor().map(k => k[0].render)), 3)
  prepareNext(controls, makeData)

  const next = controls.state?.next

  return (
    <>
      {(next && next.at(0) && next.at(0).join) && next?.at(0)?.join(', ')}
      <br />
      queued: {next?.length ? next?.flat().length - 1 : 'n/a'}
    </>
  )
}

export default Keys
