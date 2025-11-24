import * as ViolinNote from '../lib/ViolinNote'
import { Score } from '../lib/Vexflow'
import { pick, shuffleArray } from '../lib/Random'

function Positions({initialState, setState, advance}) {
  const defaultPositions = ViolinNote.positions.map((_ , i) => i)

  let state = initialState || {shuffle: false}

  if (advance)
    setState(state => ({...state, random: Math.random}))

  function toggleShuffle() {
    setState(state => ({...state, shuffle: !state.shuffle}))
  }

  function getPositions() {
    return state.positions || defaultPositions
  }

  function togglePosition(p) {
    const positions = getPositions()
    positions[p] = positions[p] === null ? p : null
    setState(state => ({...state, positions: positions}))
  }

  const shuffleFun = state?.shuffle ? shuffleArray : x => x

  const notes = shuffleFun([0, 1, 2, 3]).map(string => {
    const note = pick(ViolinNote.randomViolinNoteEasyScore(string, pick(getPositions().filter(a => a !== null))))
    const fingering = note.finger == '.½' ? 's' : note.finger
    const render =
      (note.base.render == note.target.render)
        ? `(${note.string} ${note.target.render})/q[fingerings=",${fingering}"]`
        : `(${note.string} ${note.base.render} ${note.target.render})/q[fingerings=",,${fingering}"]`
    return render
  }).join(', ')

  // console.log(getPositions().filter(a => a).map(a => `${a}, ${JSON.stringify(ViolinNote.positions[a])}`))

  return <>
    <div>
      <div style={{margin: '0 0 0.5em', textAlign: 'left'}} data-refresh={state.random}>
        <label>
          shuffle strings: <input type="checkbox" defaultChecked={state.shuffle} onChange={_ => toggleShuffle()} />
        </label>
        <br />
        <div>
          positions ({getPositions().filter(a => a !== null).map(a => ViolinNote.positions[a].name.replace(/\.$/, '')).join(',')}): <br />
          {Array(12).fill(null).map((_, i) => {
            return <input data-key={i} key={i} type="checkbox" defaultChecked={getPositions()[i] !== null} onChange={_ => togglePosition(i)} />
          })}
        </div>
      </div>

      <Score width={300} height={300} notes={notes} timeSignature="4/4" />
    </div>
  </>
}

export default Positions
