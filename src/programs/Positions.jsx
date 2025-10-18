import { randomViolinNoteEasyScore } from '../lib/ViolinNote'
import { Score } from '../lib/Vexflow'
import { pick, shuffleArray } from '../lib/Random'

function Positions({state, setState, advance}) {
  function toggleShuffle() {
    console.log(state)
    setState({shuffle: !state.shuffle})
  }

  const shuffleFun = state.shuffle ? shuffleArray : x => x

  const notes = shuffleFun([0, 1, 2, 3]).map(string => {
    const note = pick(randomViolinNoteEasyScore(string))
    const fingering = note.finger == '.½' ? 's' : note.finger
    const render =
      (note.base.render == note.target.render)
        ? `(${note.string} ${note.target.render})/q[fingerings=",${fingering}"]`
        : `(${note.string} ${note.base.render} ${note.target.render})/q[fingerings=",,${fingering}"]`
    return render
  }).join(', ')

  return <>
    <div>
      <div style={{marginBottom: '0.5em'}}>
        <label>
          <input type="checkbox" defaultChecked={state.shuffle} onChange={_ => toggleShuffle()} /> shuffle
        </label>
      </div>

      <Score width={300} height={300} notes={notes} timeSignature="4/4" />
    </div>
  </>
}

export default Positions
