import OpenSheetMusicDisplay from '../lib/OpenSheetMusicDisplay'
import * as ToneLib from '../lib/ToneLib'
import { pointwiseInterval, findMajor } from '../lib/ToneLib'
import { note, notesToMusic } from '../lib/MusicXML'
import { chunk } from '../lib/Array'
import { stringAboveOpen, stringsForTonality } from '../lib/ToneLibViolin'

const p = ToneLib.parseNote.bind(ToneLib)

//         note(p('eb'), 2),
//         note(p('f5'), 2, {bowing: 'up', tied: true, filled: 'no'}),
//         note(p('c5'), 1, {notehead: 'x'}),
//         note(p('a'), 1),
//       ],
//       [
//         note(p('e'), 2, {bowing: 'down', color: '#FF0000'}),
//         // note(p('f'), 2),
//         note(p('e'), 2, {slur: slurBegin}),
//         note(p('f'), 2, {slur: slurEnd}),

function galamianScale() {
  const scale = [p('c4')].concat(
    pointwiseInterval(p('e4')!, p('c4')!, p('c7')!, p('c4')!)
  ).concat(
    pointwiseInterval(p('e4')!, p('d4')!)
  )

  const ns = chunk(scale, 3).map(ns =>
    ns.map((n, i) => {
      return note(n, 2, { beamNumber: 1, beam: i == 0 ? 'begin' : i == ns.length - 1 ? 'end' : 'continue' })
    })
  )

  return chunk(ns, 4).map(ns => ns.flat())
}

// grid-scale, 4x4
function markovScale(tonic: string) {
  const key = findMajor(p(tonic)!)!
  const scale = stringsForTonality(key).map(stringAboveOpen).map(s => s.positions.slice(0, 4)).flat()

  const ns = chunk(scale, 4).map(ns =>
    ns.map((n, i) => {
      return note(n, 1, { beamNumber: 1, beam: i == 0 ? 'begin' : i == ns.length - 1 ? 'end' : 'continue' })
    })
  )

  return chunk(ns, 4).map(ns => ns.flat())
}

export default function SheetOSMD() {
  // const xml = notesToMusic(galamianScale())
  const xml = notesToMusic(markovScale('gb'))

  return <OpenSheetMusicDisplay file={xml} />
}
