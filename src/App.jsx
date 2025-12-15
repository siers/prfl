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
  const timeout = useRef()

  const defaultProgram = Object.keys(programs)[0]
  const [state, setState] = useLocalStorage('programState', {})
  const [program, setProgram] = useLocalStorage('program', defaultProgram)
  const makeItem = (advance) => {
    // the program should advance itself, if the state is empty
    const programName = (programs[program] && program) || defaultProgram
    const setProgramState = nextProgramState => {
      const newState = nextProgramState instanceof Function ? nextProgramState(state[programName]) : nextProgramState
      setState(state => ({...state, [programName]: newState}))
    }
    return programs[programName](
      {state: state[programName], setState: setProgramState, advance}
    )
  }
  const content = useRef()

  const flash = () => {
    const el = content.current
    el.classList.toggle("flash1")
    el.classList.toggle("flash2")
  }

  const setItem = () => {
    makeItem(true)
    flash()
  }

  const postponeTimeout = () => { clearTimeout(timeout.current); timeout.current = setTimeout(() => setItem(), speed) }
  const startTimeout = () => { setRunning(true); timeout.current = setTimeout(() => setItem(), speed) }
  const stopTimeout = () => { setRunning(false); clearTimeout(timeout.current); }
  const toggleTimeout = () => { if (running) stopTimeout(); else startTimeout() }

  function button(event, key) {
    if (key == 's' || key == 'p' || key == 'Escape') toggleTimeout()
    if (key == 'ArrowRight' || key == 'PageUp' || key == 'ArrowDown' || key == 'Enter' || key == ' ') {
      setItem()
      postponeTimeout()
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
      startTimeout()
    }
    return () => stopTimeout()
  }, [running, speed, program, state])

  return (
    <>
      <div className="app">
        <select onChange={e => setProgram(e.target.value)} value={program} className="programs">
          {Object.keys(programs).map(p => <option value={p} key={p}>{p}</option>)}
        </select>

        <a className="next" onClick={() => setItem()}>➡️</a>

        <div className="wrap" style={{display: "block"}} data-mode={program}>
          <div ref={content} className="content flash1">
            {makeItem()}
          </div>
        </div>

        <div className="log">
        </div>

        <div className="knob-wrapwrap">
          <Knob running={running} setRunning={setRunning} angle={speed} setAngle={setSpeed} gain={20} format={n => `${n / 1000} s\n / ${Math.round(60 / (n / 1000))} bpm`} />
        </div>

        <a className="clear" onClick={() => setState({})}>clear state</a>
      </div>
    </>
  )
}

export default App
