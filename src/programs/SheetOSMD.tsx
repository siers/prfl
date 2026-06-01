import OpenSheetMusicDisplay from '../lib/OpenSheetMusicDisplay'
import * as ToneLib from '../lib/ToneLib'
import { pointwiseInterval, findMajor } from '../lib/ToneLib'
import { note, notesToMusic } from '../lib/MusicXML'
import { chunk, transpose } from '../lib/Array'
import { stringAboveOpen, stringsForTonality } from '../lib/ToneLibViolin'
import { parseInt } from 'lodash'
import { Note } from '@stringsync/musicxml/dist/generated/elements'
import { shuffleArray } from '../lib/Random'

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

type MarkovParams = {
  tonic: string,
  position: number,
  flip?: number,
  random?: string, // (none), v(ertical), h(orizontal), r(andom)
}

function pipe<A>(a: A, ...fns: ((a: A) => A)[]): A {
  return fns.reduce((a, f) => f(a), a)
}

// grid-scale, 4x4
function markovScaleOne(mp: MarkovParams): Note[][] {
  const { tonic, position, random } = mp
  const key = findMajor(p(tonic)!)!

  const pos= position - 1
  let scale = stringsForTonality(key).map(stringAboveOpen).map(s => s.positions.slice(pos, pos + 4)).flat()
  mp.flip == 1 && (scale = scale.reverse())

  const rv = random?.includes('v') || false
  const rr = random?.includes('r') || false
  const rh = random?.includes('h') || false

  const ns =
    pipe(
      chunk(rr ? shuffleArray(scale) : scale, 4),
      ns => ns.map(ns => rv ? shuffleArray(ns) : ns),
      ns => transpose(transpose(ns).map(ns => rh ? shuffleArray(ns) : ns)),
      ns => rr ? shuffleArray(ns) : ns,
    )

  const nsBeamed = ns.map(ns =>
    ns.map((n, i) =>
      note(n, 1, { beamNumber: 1, beam: i == 0 ? 'begin' : i == ns.length - 1 ? 'end' : 'continue' })
    )
  )

  return chunk(nsBeamed, 2).map(ns => ns.flat())
}

function markovScale(mp: MarkovParams) {
  return markovScaleOne(mp).concat(markovScaleOne({ ...mp, flip: 1 }))
}

export default function SheetOSMD(params_: { params: { scale?: string, position?: string, key?: string, random?: string } }) {
  const params = params_.params
  const scale =
    params.scale == 'markov'
      ? markovScale({ tonic: params.key || 'c', position: params.position ? parseInt(params.position) : 1, random: params.random })
      : galamianScale()

  const xml = notesToMusic(scale)

  return <OpenSheetMusicDisplay file={xml} />
}
