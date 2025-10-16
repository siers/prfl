import { randomViolinNote } from './lib/ViolinNote'
import ToneLib from './lib/ToneLib'
import { Score } from './Vexflow'
import { randomViolinNoteEasyScore } from './lib/ViolinNote'

function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1))
    var temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
  return array
}

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)]
}

function getHash() {
  return location.hash.substr(1)
}

function getThings() {
  return (getHash() != '') ? getHash().split(':').at(-1).split('-') : [0, 1, 2, 3]
}

function Violin() {
  return <div dangerouslySetInnerHTML={{__html: randomItem(randomViolinNote())[1]}} />
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

function Hash() {
  return randomItem(getThings())
}

function Sheet() {
  function randInt(from, to) {
    return from + Math.floor(Math.random() * (to - from + 1))
  }

  function pick(array) {
    return array[randInt(0, array.length - 1)]
  }

  const notes = [1, 2, 3, 4].map(_ => {
    const note = pick(randomViolinNoteEasyScore())
    const fingering = note.finger == '.½' ? 's' : note.finger
    const render =
      (note.base.render == note.target.render)
        ? `(${note.string} ${note.target.render})/q[fingerings=",${fingering}"]`
        : `(${note.string} ${note.base.render} ${note.target.render})/q[fingerings=",,${fingering}"]`
    return render
  }).join(', ')

  return <Score width={300} height={300} notes={notes} timeSignature="4/4" />

}

const programs = {
  violin: Violin,
  keys: Keys,
  hash: Hash,
  sheet: Sheet,
}

export default programs
