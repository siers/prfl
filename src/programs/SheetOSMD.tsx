import OpenSheetMusicDisplay from '../lib/OpenSheetMusicDisplay'
import { asserts, elements, MusicXML } from '@stringsync/musicxml'
import ToneLib from '../lib/ToneLib'
import { note, notesToMusic, slurMarkers } from '../lib/MusicXML'

const p = ToneLib.parseNote.bind(ToneLib)

// const r = await fetch('./notes/2025-12-07-musicxml/two-bars-slur.musicxml')
// const rb = await r.text()
// window.rb = rb
// window.m=MusicXML.parse(rb)

export default function SheetOSMD() {
  const [slurBegin, slurEnd] = slurMarkers(1)

  const xml = notesToMusic(
    [
      [
        note(p('e'), 2),
        note(p('f5'), 2, {tied: true}),
        note(p('b'), 2),
      ],
      [
        note(p('e'), 2, {down: true}),
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
