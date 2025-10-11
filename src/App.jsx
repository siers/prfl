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
  const [command, setCommand] = useState(0)
  const [running, setRunning] = useState(true)
  const number = useRef()
  const interval = useRef()

  const makeItem = useCallback(() => {
    console.log('nextitem')

    return Math.floor(Math.random() * 100)

    // document.querySelector('.wrap').dataset.mode = getMode()
    // if (getMode() == 'violin') {
    //   let [semi, name] = pick(randomViolinNote())
    //   number.innerHTML = name
    //   tone = semi
    // } else
    //   number.innerHTML = randomItem(getThings())
    // stop() // must come after `timeoutId = ...`

    // number.innerHTML = randomItem(getThings())
  })

  const startInterval = () => { setRunning(true); interval.current = setInterval(() => setCommand(makeItem()), 1000) }
  const stopInterval = () => { setRunning(false); clearInterval(interval.current); console.log('stop'); }

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
    if (running) {
      startInterval()
    }

    return () => {
      // console.log('clear interval')
      stopInterval()
    }
  }, [running])

  return (
    <>
      {!running && <a className="start" onClick={() => startInterval()}>start</a>}
      {running && <a className="stop" onClick={() => stopInterval()}>stop</a>}

      <div className="wrap" style={{ display: "block" }}>
        <div ref={number} className="number">{command}</div>
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
