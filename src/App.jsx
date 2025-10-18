import { useEffect, useCallback, useState, useRef } from 'react'
import './App.css'
import Knob from './Knob'
import programs from './Programs'

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* ignore write errors */
    }
  }, [key, value])

  return [value, setValue]
}

function App() {
  const [running, setRunning] = useLocalStorage('running', true)
  const [speed, setSpeed] = useLocalStorage('speed', 1500)
  const interval = useRef()

  const [state, setState] = useState({})
  const [program, setProgram] = useLocalStorage('program', 'violin')
  const [command, setCommand] = useState('-')
  const makeItem = (advance) => {
    const programState = window.structuredClone(state[program]) || {}
    const setProgramState = newState => {
      state[program] = newState
      setState(state)
    }
    const result = programs[program]({state: programState, setState: setProgramState, advance})
    return result
  }
  const content = useRef()

  const flash = () => {
    const el = content.current
    el.classList.toggle("flash1")
    el.classList.toggle("flash2")
  }

  const setItem = () => {
    setCommand(makeItem(true))
    flash()
  }

  const postponeInterval = () => { clearInterval(interval.current); interval.current = setInterval(() => setItem(), speed) }
  const startInterval = () => { setRunning(true); interval.current = setInterval(() => setItem(), speed) }
  const stopInterval = () => { setRunning(false); clearInterval(interval.current); }
  const toggleInterval = () => { if (running) stopInterval(); else startInterval() }

  function button(event, key) {
    if (key == 's' || key == 'Escape') toggleInterval()
    if (key == 'ArrowRight' || key == 'PageUp' || key == 'ArrowDown' || key == 'Enter' || key == ' ') {
      setItem()
      postponeInterval()
    }
  }

  let timeoutId

  useEffect(() => {
    const handleKey = (e) => button(event, e.key)
    addEventListener('keydown', handleKey)

    return () => {
      removeEventListener('keydown', handleKey)
    }
  })

  useEffect(() => {
    if (running) {
      setItem()
      startInterval()
    }
    return () => stopInterval()
  }, [running, speed, program])

  return (
    <>
      <div className="app">
        <select onChange={e => setProgram(e.target.value)} value={program} className="programs">
          {
            Object.keys(programs).map(p =>
              <option value={p} key={p}>{p}</option>
            )
          }
        </select>

        <a className="next" onClick={() => setItem()}>➡️</a>

        <div className="wrap" style={{ display: "block" }} data-mode={program}>
          <div ref={content} className="content flash1">
            {makeItem()}
          </div>
        </div>

        <div className="log">
        </div>

        <div className="knob-wrapwrap">
          <Knob running={running} setRunning={setRunning} angle={speed} setAngle={setSpeed} gain={20} format={n => `${n / 1000} s`} />
        </div>
      </div>
    </>
  )
}

export default App
