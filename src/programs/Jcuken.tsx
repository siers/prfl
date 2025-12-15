import { prepareNext, renderNext } from '../lib/Program'
import { shuffleArray } from '../lib/Random'

// frequency control functions would be useful here
export default function Jcuken(controls) {
  const row1 = 'яшертыуиопюж'
  const row2 = 'асдфгчйклэ'
  const row3 = 'зхцвбнм'
  const alphabet = (row1 + row2 + row3).split('')

  const makeData = () => shuffleArray(alphabet)

  function flashLetter(letter, subclass) {
    if (alphabet.indexOf(letter) === -1) return

    // useRef complains about false ordering, can't imagine how to fix it right now
    const el = document.querySelector('.wrap[data-mode=jcuken] .letter')
    el.innerText = letter
    el.classList.remove("correct", "incorrect")
    el.classList.add(subclass)
    el.classList.toggle("letter-flash1")
  }

  function onEvent(e) {
    const typeCorrect = e.type == 'keydown'
    const correctHit = controls.state?.next[0] == e.key

    if (typeCorrect && correctHit) prepareNext({...controls, advance: true}, makeData)
    flashLetter(e.key, correctHit && 'correct' || 'incorrect')
  }

  const event = controls.event
  if (event) onEvent(event)

  prepareNext({...controls, advance: false}, makeData)

  return <>
    <div className="letter letter-flash1">&nbsp;</div>

    {renderNext(controls.state, {count: 3})}
  </>
}
