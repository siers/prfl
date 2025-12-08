import * as ViolinNote from '../lib/ViolinNote'
import { Score } from '../lib/Vexflow'
import { pick, shuffleArray } from '../lib/Random'
import OpenSheetMusicDisplay from '../lib/OpenSheetMusicDisplay'
import { note, notesToMusic } from '../lib/MusicXML'
import ToneLib from '../lib/ToneLib'

function Positions({state, setState, advance}) {
  const defaultPositions = ViolinNote.positions.map((_ , i) => i)

  const shuffleFun = state?.shuffle ? shuffleArray : x => x

  function generateNotes(shuffleFun) {
    return shuffleFun([0, 1, 2, 3]).map(string =>
      pick(ViolinNote.randomViolinNoteEasyScore(
        string,
        pick(getPositions().filter(a => a !== null)),
        pick(state?.withoutTopNote ? [0] : ViolinNote.positionSemitones)
      ))
    )
  }

  function positionsToMusic(notes) {
    return notesToMusic([
      notes.flatMap(n => {
        if (state?.withoutTopNote)
          return [
            note(n.base, 1, {color: '#000000'}),
            note(ToneLib.parseNote(n.string), 1, {tied: true, color: '#CCCCCC'}),
          ]
        else
          return [
            note(n.target, 1),
            note(n.base, 1, {tied: true, color: '#999999'}),
            note(ToneLib.parseNote(n.string), 1, {tied: true, color: '#CCCCCC'}),
          ]
      })
    ])
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
      <div className="controls">
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

      {state?.notes && <OpenSheetMusicDisplay file={positionsToMusic(state.notes)} />}
    </div>
  </>
}

export default Positions
