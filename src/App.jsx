import { useEffect, useState, useRef } from 'react'
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
  const [running, setRunning] = useLocalStorage('running', false)

  const [speed, setSpeed] = useLocalStorage('speed', 1500)
  const timeout = useRef()
  const content = useRef()

  const defaultProgram = 'randomize' // Object.keys(programs)[0]
  const [state, setState] = useLocalStorage('programState', {})
  const [program, setProgram] = useLocalStorage('program', defaultProgram)

  const advanceRef = useRef(null)

  useEffect(() => {
    const handleKey = (e) => button(e, e.key)
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

  const setProgramState = programName => nextProgramState => {
    setState(state => ({
      ...state,
      [programName]: nextProgramState instanceof Function ? nextProgramState(state[programName]) : nextProgramState
    }))
  }
  const programName = (programs[program] && program) || defaultProgram
  const ProgramComponent = programs[programName]

  const setItem = (advance, event) => {
    if (advance && advanceRef.current) advanceRef.current(advance, event)
    flash()
  }

  const flash = () => {
    const el = content.current
    el.classList.toggle("flash1")
    el.classList.toggle("flash2")
  }

  const postponeTimeout = () => { clearTimeout(timeout.current); timeout.current = setTimeout(() => setItem('timeout'), speed) }
  const startTimeout = () => { setRunning(true); timeout.current = setTimeout(() => setItem('timeout'), speed) }
  const stopTimeout = () => { setRunning(false); clearTimeout(timeout.current); }
  const toggleTimeout = () => { if (running) stopTimeout(); else startTimeout() }

  function button(event, key) {
    if (key == 's' || key == 'p' || key == 'Escape') toggleTimeout()
    else if (key == 'ArrowRight' || key == 'PageUp' || key == 'ArrowDown' || key == 'Enter' || key == ' ') {
      setItem('next', event)
      postponeTimeout()
    } else if (key == 'ArrowLeft' || key == 'PageDown' || key == 'ArrowUp') {
      setItem('prev', event)
    } else {
      setItem(false, event)
    }
  }

  return (
    <div className="app p-1em">
      <div className="flex flex-col h-dvh">
        <div className="block w-full m-[1em] mr-auto ml-auto grow-0 text-center" >
          <select onChange={e => setProgram(e.target.value)} value={program} className="programs inline-block m-auto grow-0 border">
            {Object.keys(programs).map(p => <option value={p} key={p}>{p}</option>)}
          </select>
        </div>

        <div className="wrap flex-1 flex flex-row items-center" data-mode={program}>
          {
            (program == "flash")
              ? (
                <div ref={content} className="content flash1">
                  {<ProgramComponent state={state[programName]} setState={setProgramState(programName)} advance={false} />}
                </div>
              ) : (
                <div className="flex flex-col items-center grow">
                  <div ref={content} className="content flash1">
                    {<ProgramComponent
                      state={state[programName]}
                      setState={setProgramState(programName)}
                      advanceRef={advanceRef}
                    />}
                  </div>
                </div>
              )
          }
        </div>
      </div>

      <div className="log">
      </div>

      <div className="knob-wrapwrap hidden">
        <Knob running={running} setRunning={setRunning} angle={speed} setAngle={setSpeed} gain={20} format={n => `${n / 1000} s\n / ${Math.round(60 / (n / 1000))} bpm`} />
      </div>

      <a className="next" onClick={event => setItem('next', event)}>➡️</a>
      <a className="prev" onClick={event => setItem('prev', event)}>⬅️</a>
    </div>
  )
}

export default App
