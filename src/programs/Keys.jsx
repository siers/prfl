import ToneLib from '../lib/ToneLib'
import { shuffleArray } from '../lib/Random'

function Keys({state, setState, advance}) {
  if ((state?.next?.length || 0) < 1) {
    const newKeys = shuffleArray((new ToneLib).keysMajor().map(k => k[0].render))
    setState(state => ({...state, next: newKeys}))
  }

  if (advance && state?.next) {
    const [, ...remaining] = state?.next
    setState(state => ({...state, next: remaining}))
  }

  return (
    <>
      {state?.next?.at(0)}
      <br />
      queued: {state?.next?.length ? state.next.length - 1 : 'n/a'}
    </>
  )
}

export default Keys
