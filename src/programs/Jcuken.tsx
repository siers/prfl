import { JSX } from 'react'
import { prepareNext, renderNext } from '../lib/Program'
import { shuffleArray } from '../lib/Random'

// frequency control functions would be useful here
export default function Jcuken(controls: any): JSX.Element {
  const { setState, advanceRef } = controls

  const row1 = 'йцукенгшщзхъ'
  const row2 = 'фывапролджэ'
  const row3 = 'ёячсмитьбю'
  const alphabet = (row1 + row2 + row3).split('')

  const makeData = () => shuffleArray(alphabet)

  function flashLetter(letter, subclass) {
    if (alphabet.indexOf(letter) === -1) return

    // useRef complains about false ordering, can't imagine how to fix it right now
    const el = document.querySelector('.wrap[data-mode=jcuken] .letter')

    el.innerText = letter
    el.classList.remove("correct", "incorrect")
    el.classList.add(subclass)

    const thisKey = parseInt(el.dataset.animationKey || 0) + 1
    el.dataset.animationKey = thisKey
    const timeout = 20

    const nextFrame = (key, opacity) => {
      if (el.dataset.animationKey == key && opacity > 0) {
        el.style.opacity = `${Math.round(opacity * 100)}%`
        setTimeout(() => nextFrame(key, Math.max(0, opacity - 0.1)), timeout)
      }
    }
    setTimeout(() => nextFrame(thisKey, 1), timeout)
  }

  advanceRef.current = (advance: string | boolean, event: KeyboardEvent | null) => {
    const key = event?.key
    const isLetter = key && alphabet.indexOf(key) !== -1

    if (isLetter) {
      const correctHit = controls.state?.next?.[0] == key
      if (correctHit) prepareNext({ state: controls.state, setState, advance: true }, makeData)
      flashLetter(key, correctHit && 'correct' || 'incorrect')
    } else if (advance == 'next' || advance == 'prev') {
      prepareNext({ state: controls.state, setState, advance: true }, makeData)
    }
  }

  prepareNext({ state: controls.state, setState, advance: false }, makeData)

  return <>
    <div className="letter letter-flash1">&nbsp;</div>

    {renderNext(controls.state, { count: 3 })}
  </>
}
