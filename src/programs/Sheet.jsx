import { randomViolinNoteEasyScore } from '../lib/ViolinNote'
import { Score } from '../lib/Vexflow'

function Sheet() {
  function randInt(from, to) {
    return from + Math.floor(Math.random() * (to - from + 1))
  }

  function pick(array) {
    return array[randInt(0, array.length - 1)]
  }

  const notes = [1, 2, 3, 4].map(_ => {
    const note = pick(randomViolinNoteEasyScore())
    const fingering = note.finger == '.½' ? 's' : note.finger
    const render =
      (note.base.render == note.target.render)
        ? `(${note.string} ${note.target.render})/q[fingerings=",${fingering}"]`
        : `(${note.string} ${note.base.render} ${note.target.render})/q[fingerings=",,${fingering}"]`
    return render
  }).join(', ')

  return <Score width={300} height={300} notes={notes} timeSignature="4/4" />
}

export default Sheet
