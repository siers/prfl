import ToneLib from '../lib/ToneLib'
import { shuffleArray } from '../lib/Random'

function Keys({state, setState, advance}) {
  if (!state.next?.length) {
    state.next = shuffleArray((new ToneLib).keysMajor().map(k => k[0].render))
    setState(state)
  }

  if (advance) {
    state.next.shift()
    setState(state)
  }

  return (
    <>
      {state.next?.at(0)}
      <br />
      queued: {state.next?.length - 1}
    </>
  )
}

export default Keys
