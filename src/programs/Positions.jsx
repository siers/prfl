import * as ViolinNote from '../lib/ViolinNote'
import { Score } from '../lib/Vexflow'
import { pick, shuffleArray } from '../lib/Random'
import OpenSheetMusicDisplay from '../lib/OpenSheetMusicDisplay'
import { note, notesToMusic } from '../lib/MusicXML'
import ToneLib from '../lib/ToneLib'

const range = (start, stop) => Array(stop - start + 1).fill(start).map((x, y) => x + y)

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

  function positionsToMusic(measures) {
    return notesToMusic(measures.map(notes =>
      notes.flatMap((n, idx) => {
        const bowing = {'V': 'up', 'Π': 'down'}[n.bowing]
        const notes = [
          ...(state?.withoutTopNote ? [] : [[n.target, 1, {color: '#000000'}]]),
          ...(state?.withoutBottomNote ? [] : [[n.base, 1, {color: '#999999'}]]),
          [ToneLib.parseNote(n.string), 1, {color: '#000000', notehead: 'x'}],
        ]

        notes[0][2] = {...notes[0][2], bowing: state.withBowings ? bowing : null, color: '#000000'}
        range(1, notes.length - 1).map(idx => notes[idx][2] = ({...notes[idx][2], tied: true}))

        return notes.map(args => note(...args))
      })
    ))
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

  function toggleBowings() {
    setState(state => ({...state, withBowings: !state.withBowings}))
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
    const length = 2
    const notes = range(1, length).map(_ => generateNotes(shuffleFun))
    setState(state => ({...state, notes: [...(state?.notes || []), ...notes].reverse().slice(0, length).reverse()}))
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
        <br />

        <label>
          with bowings: <input type="checkbox" checked={state?.withBowings || false} onChange={_ => toggleBowings()} />
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
