import { useEffect, useCallback, useState, useRef } from 'react'
import './App.css'

function getHash() {
  return location.hash.substr(1)
}

function getInterval() {
  var parts = getHash().indexOf(':') == -1 ? [] : getHash().split(':')
  return parts[0] || 3000
}

function getThings() {
  return (getHash() != '') ? getHash().split(':').at(-1).split('-') : [0, 1, 2, 3]
}

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)]
}

function App() {
  const [count, setCount] = useState(0)
  const number = useRef()
  const interval = useRef()

  const startInterval = () => interval.current = setInterval(nextItem, 1000)
  const stopInterval = () => clearInterval(interval.current)

  const nextItem = useCallback(() => {
    console.log('nextitem')

    // document.querySelector('.wrap').dataset.mode = getMode()
    // if (getMode() == 'violin') {
    //   let [semi, name] = pick(randomViolinNote())
    //   number.innerHTML = name
    //   tone = semi
    // } else
    //   number.innerHTML = randomItem(getThings())
    // stop() // must come after `timeoutId = ...`

    number.innerHTML = randomItem(getThings())
  })

  // function button(event, key) {
  //   if (key == 's' || key == 'Escape') stop(event)
  //   if (key == 'ArrowRight' || key == 'PageUp' || key == 'ArrowDown' || key == 'Enter' || key == ' ') nextItem()
  // }

  let tone
  let timeoutId

  useEffect(() => {
    // addEventListener('hashchange', () => document.location.reload())
    // addEventListener('keydown', (e) => button(event, e.key))
  })

  useEffect(() => {
    // console.log('set interval')
    startInterval()

    return () => {
      // console.log('clear interval')
      stopInterval()
    }
  }, [nextItem])

  return (
    <>
      <a className="start" xonclick="nextItem()">start</a>
      <a className="stop" xonclick="stop()">stop</a>

      <div className="wrap" style={{ display: "block" }}>
        <div ref={number} className="number">0</div>
      </div>

      <div className="log">
      </div>

      <div style={{ display: "none" }} className="string-symbols">
        <svg className="icon" width="48" height="48" viewBox="0 0 48 48" style={{ marginBottom: "-9px" }}>
          <rect x="0" y="30" width="48" height="3" fill="#fff"/>
        </svg>

        <svg className="icon" width="48" height="48" viewBox="0 0 48 48" style={{ marginBottom: "-9px" }}>
          <rect x="0" y="30" width="48" height="3" fill="#fff"/>
          <rect x="0" y="20" width="48" height="3" fill="#fff"/>
        </svg>

        <svg className="icon" width="48" height="48" viewBox="0 0 48 48" style={{ marginBottom: "-9px" }}>
          <rect x="0" y="30" width="48" height="3" fill="#fff"/>
          <rect x="0" y="20" width="48" height="3" fill="#fff" />
          <rect x="0" y="10" width="48" height="3" fill="#fff"/>
        </svg>

        <svg className="icon" width="48" height="48" viewBox="0 0 48 48" style={{ marginBottom: "-9px" }}>
          <rect x="0" y="30" width="48" height="3" fill="#fff"/>
          <rect x="0" y="20" width="48" height="3" fill="#fff"/>
          <rect x="0" y="10" width="48" height="3" fill="#fff"/>
          <rect x="0" y="00" width="48" height="3" fill="#fff"/>
        </svg>
      </div>
    </>
  )
}

export default App
