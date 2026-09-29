import { useEffect, useState, useRef } from 'react'
import './App.css'
import Randomize from './programs/Randomize'

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  }, [])

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
  const [state, setState] = useLocalStorage('programState', {})

  const advanceRef = useRef(null)

  useEffect(() => {
    const handleKey = (e) => button(e, e.key)
    addEventListener('keydown', handleKey)

    return () => {
      removeEventListener('keydown', handleKey)
    }
  }, [])

  const programName = 'randomize'
  const setProgramState = programName => nextProgramState => {
    setState(state => ({
      ...state,
      [programName]: nextProgramState instanceof Function ? nextProgramState(state[programName]) : nextProgramState
    }))
  }

  const setItem = (advance, event) => {
    if (advanceRef.current) advanceRef.current(advance, event)
  }

  function button(event, key) {
    if (key == 'ArrowRight' || key == 'PageUp' || key == 'ArrowDown' || key == 'Enter' || key == ' ') {
      setItem('next', event)
    } else if (key == 'ArrowLeft' || key == 'PageDown' || key == 'ArrowUp') {
      setItem('prev', event)
    } else {
      setItem(false, event)
    }
  }

  return (
    <div className="app">
      <div className="flex flex-col h-dvh">
        <div className="randomize wrap flex-1 flex flex-col items-center justify-between">
          {<Randomize
            state={state[programName]}
            setState={setProgramState(programName)}
            advanceRef={advanceRef}
          />}
        </div>
      </div>
    </div>
  )
}

export default App
