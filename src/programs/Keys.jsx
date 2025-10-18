import ToneLib from '../lib/ToneLib'

function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1))
    var temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
  return array
}

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