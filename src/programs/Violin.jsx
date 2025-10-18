import { randomViolinNote } from '../lib/ViolinNote'

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)]
}

function Violin() {
  return <div dangerouslySetInnerHTML={{__html: randomItem(randomViolinNote())[1]}} />
}

export default Violin