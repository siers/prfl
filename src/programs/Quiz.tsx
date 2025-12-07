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

function Quiz(controls) {
  const makeData = () => shuffleArray(['D', 'C', 'G', 'B', '♣️', '♠️', '♥️', '♦️']) // '☆',
  prepareNext(controls, makeData)

  const next = controls.state?.next

  return (
    <>
      {next?.at(0)}
      <br />
      queued: {next?.length ? next?.flat().length - 1 : 'n/a'}
    </>
  )
}

export default Quiz
