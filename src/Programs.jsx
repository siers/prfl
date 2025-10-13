import { randomViolinNote } from './lib/ViolinNote'
import ToneLib from './lib/ToneLib'
import { Score } from './Vexflow'

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
    console.log(`setting: state.next = ${shuffleArray((new ToneLib).keysMajor().map(k => k[0].render))}`)
    setState(state)
  }

  if (advance) {
    state.next.shift()
    setState(state)
    console.log(`keys advancing`)
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
  return <Score staves={[
        ['G#/3', 'd4', 'e4', 'd4'],
        ['a4', 'd4', 'e4', 'd4'],
        ['a4', 'a4', 'b4', 'a4'],
        ['d4', 'e4', ['g3', 2]],
      ]} />
}

const programs = {
  violin: Violin,
  keys: Keys,
  hash: Hash,
  sheet: Sheet,
}

export default programs
