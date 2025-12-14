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
      pick(ViolinNote.randomViolinNotePlain(
        string,
        pick(getPositions().filter(a => a !== null)),
        pick(ViolinNote.positionSemitones)
      ))
    )
  }

  function positionsToMusic(notes) {
    return notesToMusic([
      notes.flatMap((n, idx) => {
        console.log(n.target, n.base)
        return [
          note(ToneLib.parseNote(n.string), 1, {color: '#CCCCCC'}),
          ...(state?.withoutTopNote ? [] : [note(n.target, 1, {tied: true})]),
          ...(state?.withoutBottomNote ? [] : [note(n.base, 1, {tied: true, color: state.withoutTopNote ? '#000000' : '#999999'})]),
        ]
      })
    ])
  }

  function toggleShuffle() {
    setState(state => ({...state, shuffle: !state.shuffle, notes: null}))
  }

  function toggleWithoutTopNote() {
    setState(state => ({...state, withoutTopNote: !state.withoutTopNote}))
  }

  function toggleWithoutBottomNote() {
    setState(state => ({...state, withoutBottomNote: !state.withoutBottomNote}))
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
        <label>
        <br />

        </label>
          without bottom note: <input type="checkbox" checked={state?.withoutBottomNote || false} onChange={_ => toggleWithoutBottomNote()} />
        </label>

        <div>
          positions
          {getPositions().map((_, i) => {
            const name = ViolinNote.positions[i].name.replace(/\.$/, '')
            return <span className="position" data-key={i} key={i} style={{'color': getPositions()[i] !== null ? '#000' : '#bbb'}} onClick={_ => togglePosition(i)}>{name}</span>
          })}
        </div>
      </div>

      {state?.notes && <OpenSheetMusicDisplay file={positionsToMusic(state.notes)} />}
    </div>
  </>
}

export default Positions
