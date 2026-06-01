import OpenSheetMusicDisplay from '../lib/OpenSheetMusicDisplay'
import * as ToneLib from '../lib/ToneLib'
import { pointwiseInterval, findMajor } from '../lib/ToneLib'
import { note, notesToMusic } from '../lib/MusicXML'
import { chunk } from '../lib/Array'
import { stringAboveOpen, stringsForTonality } from '../lib/ToneLibViolin'
import { parseInt } from 'lodash'

const p = ToneLib.parseNote.bind(ToneLib)

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

type MarkovParams = { tonic: string, position: number, flip?: number }

// grid-scale, 4x4
function markovScaleOne(mp: MarkovParams): Note[][] {
  const { tonic, position } = mp
  const key = findMajor(p(tonic)!)!

  let scale = stringsForTonality(key).map(stringAboveOpen).map(s => s.positions.slice(position, position + 4)).flat()
  mp.flip == 1 && (scale = scale.reverse())

  const ns = chunk(scale, 4).map(ns =>
    ns.map((n, i) => {
      return note(n, 1, { beamNumber: 1, beam: i == 0 ? 'begin' : i == ns.length - 1 ? 'end' : 'continue' })
    })
  )

  return chunk(ns, 2).map(ns => ns.flat())
}

function markovScale(mp: MarkovParams) {
  return markovScaleOne(mp).concat(markovScaleOne({ ...mp, flip: 1 }))
}

export default function SheetOSMD(params_: { params: { scale?: string, position?: string, key?: string } }) {
  const params = params_.params
  const scale =
    params.scale == 'markov'
      ? markovScale({ tonic: params.key || 'c', position: params.position ? parseInt(params.position) : 1 })
      : galamianScale()

  const xml = notesToMusic(scale)

  return <OpenSheetMusicDisplay file={xml} />
}
