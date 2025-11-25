import * as ViolinNote from '../lib/ViolinNote'
import { Score } from '../lib/Vexflow'
import { pick, shuffleArray } from '../lib/Random'

function Positions({state, setState, advance}) {
  const defaultPositions = ViolinNote.positions.map((_ , i) => i)

  const shuffleFun = state?.shuffle ? shuffleArray : x => x

  function generateNotes(shuffleFun) {
    return shuffleFun([0, 1, 2, 3]).map(string => {
      const note = pick(ViolinNote.randomViolinNoteEasyScore(
        string,
        pick(getPositions().filter(a => a !== null)),
        pick(state?.withoutTopNote ? [0] : ViolinNote.positionSemitones)
      ))
      const fingering = note.finger == '.½' ? 's' : note.finger
      const render =
        (note.base.render == note.target.render)
          ? `(${note.string} ${note.target.render})/q[fingerings=",${fingering}"]`
          : `(${note.string} ${note.base.render} ${note.target.render})/q[fingerings=",,${fingering}"]`
      return render
    }).join(', ')
  }

  function toggleShuffle() {
    setState(state => ({...state, shuffle: !state.shuffle, notes: null}))
  }

  function toggleWithoutTopNote() {
    setState(state => ({...state, withoutTopNote: !state.withoutTopNote, notes: null}))
  }

  function getPositions() {
    return state?.positions || defaultPositions
  }

  function togglePosition(p) {
    const positions = getPositions()
    positions[p] = positions[p] === null ? p : null
    setState(state => ({...state, positions: positions, notes: null}))
  }

  function doAdvance() {
    const notes = generateNotes(shuffleFun)
    setState(state => ({...state, notes}))
  }

  if (advance || !state?.notes) {
    doAdvance()
  }

  return <>
    <div>
      <div style={{margin: '0 0 0.5em', textAlign: 'left'}}>
        <label>
          shuffle strings: <input type="checkbox" checked={state?.shuffle || false} onChange={_ => toggleShuffle()} />
        </label>
        <br />
        <label>
          without top note: <input type="checkbox" checked={state?.withoutTopNote || false} onChange={_ => toggleWithoutTopNote()} />
        </label>
        <div>
          positions ({getPositions().filter(a => a !== null).map(a => ViolinNote.positions[a].name.replace(/\.$/, '')).join(',')}): <br />
          {Array(12).fill(null).map((_, i) => {
            return <input data-key={i} key={i} type="checkbox" checked={getPositions()[i] !== null} onChange={_ => togglePosition(i)} />
          })}
        </div>
      </div>

      {state?.notes && <Score width={300} height={300} notes={state.notes} timeSignature="4/4" />}
    </div>
  </>
}

export default Positions
