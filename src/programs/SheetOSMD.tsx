import OpenSheetMusicDisplay from '../lib/OpenSheetMusicDisplay'
import { asserts, elements, MusicXML } from '@stringsync/musicxml'
import { pointwiseInterval } from '../lib/ToneLib'
import * as ToneLib from '../lib/ToneLib'
import { note, notesToMusic, slurMarkers } from '../lib/MusicXML'
import { chunk } from '../lib/Array'

const p = ToneLib.parseNote.bind(ToneLib)

// const r = await fetch('./notes/2025-12-07-musicxml/two-bars-slur.musicxml')
// const rb = await r.text()
// window.rb = rb
// window.m=MusicXML.parse(rb)
// // m.root.contents.at(-1)[0].contents[0][0].contents[0][5].contents[14][0].contents[2][0].contents

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

export default function SheetOSMD() {
  // const [slurBegin, slurEnd] = slurMarkers(1)

  const scale = pointwiseInterval(p('c4')!, p('c7')!, p('c4')!)
  const ns = chunk(scale, 4).map(ns =>
    ns.map((n, i) => {
      return note(n, 2, { beamNumber: 1, beam: i == 0 ? 'begin' : i == ns.length - 1 ? 'end' : 'continue' })
    })
  )

  const nss = chunk(ns, 3).map(ns => ns.flat())

  const xml = notesToMusic(nss)

  return <OpenSheetMusicDisplay file={xml} />
}
