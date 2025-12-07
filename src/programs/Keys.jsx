import ToneLib from '../lib/ToneLib'
import { shuffleArray } from '../lib/Random'

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
  prepareNext(controls, () => shuffleArray((new ToneLib).keysMajor().map(k => k[0].render)))

  const next = controls.state?.next

  return (
    <>
      {next?.at(0)}
      <br />
      queued: {next?.length ? next.length - 1 : 'n/a'}
    </>
  )
}

export default Keys
