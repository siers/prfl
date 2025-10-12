import { useEffect, useCallback, useState, useRef } from 'react'
import './App.css'
import { randomViolinNote } from './lib/ViolinNote'

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

  const flash = () => {
    const el = number.current
    el.classList.toggle("flash1")
    el.classList.toggle("flash2")
  }

  const makeItem = useCallback(() => {
    return randomItem(randomViolinNote())[1]
  })

  const setItem = () => {
    setCommand(makeItem())
    flash()
  }

  const postponeInterval = () => { clearInterval(interval.current); interval.current = setInterval(() => setItem(), 1000) }
  const startInterval = () => { setRunning(true); interval.current = setInterval(() => setItem(), 1000) }
  const stopInterval = () => { setRunning(false); clearInterval(interval.current); console.log('stop'); }
  const toggleInterval = () => { if (running) stopInterval(); else startInterval() }

  function button(event, key) {
    if (key == 's' || key == 'Escape') toggleInterval()
    if (key == 'ArrowRight' || key == 'PageUp' || key == 'ArrowDown' || key == 'Enter' || key == ' ') {
      setItem()
      postponeInterval()
    }
  }

  let tone
  let timeoutId

  useEffect(() => {
    const handleKey = (e) => button(event, e.key)
    addEventListener('keydown', handleKey)

    return () => {
      removeEventListener('keydown', handleKey)
    }
  })

  useEffect(() => {
    if (running) startInterval()
    return () => stopInterval()
  }, [running])

  return (
    <>
      <a className="toggle" onClick={() => toggleInterval()}>
        {running && "stop" || "start"}
      </a>

      <a className="next" onClick={() => setItem()}>➡️</a>

      <div className="wrap" style={{ display: "block" }} data-mode="violin">
        <div ref={number} className="number flash1" dangerouslySetInnerHTML={ { __html: command } }></div>
      </div>

      <div className="log">
      </div>
    </>
  )
}

export default App
