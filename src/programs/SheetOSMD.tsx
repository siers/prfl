import OpenSheetMusicDisplay from '../lib/OpenSheetMusicDisplay'
import { asserts, elements, MusicXML } from '@stringsync/musicxml'
import ToneLib from '../lib/ToneLib'
import { note, notesToMusic, slurMarkers } from '../lib/MusicXML'

const p = ToneLib.parseNote.bind(ToneLib)

// const r = await fetch('./notes/2025-12-07-musicxml/two-bars-slur.musicxml')
// const rb = await r.text()
// window.rb = rb
// window.m=MusicXML.parse(rb)
// // m.root.contents.at(-1)[0].contents[0][0].contents[0][5].contents[14][0].contents[2][0].contents

export default function SheetOSMD() {
  const [slurBegin, slurEnd] = slurMarkers(1)

  const xml = notesToMusic(
    [
      [
        note(p('eb'), 2),
        note(p('f5'), 2, {bowing: 'up', tied: true, filled: 'no'}),
        note(p('c5'), 1, {notehead: 'x'}),
        note(p('a'), 1),
      ],
      [
        note(p('e'), 2, {bowing: 'down', color: '#FF0000'}),
        // note(p('f'), 2),
        note(p('e'), 2, {slur: slurBegin}),
        note(p('f'), 2, {slur: slurEnd}),
      ],
    ],
  )

  // console.log('sosmd', slurBegin, slurEnd)
  // console.log('das Ganze', xml)

  window.x = note(p('e'), 2, {down: true})

  // return <OpenSheetMusicDisplay file={rb} />
  return <OpenSheetMusicDisplay file={xml} />
}
