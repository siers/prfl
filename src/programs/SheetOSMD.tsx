import OpenSheetMusicDisplay from '../lib/OpenSheetMusicDisplay'
import { asserts, elements, MusicXML } from '@stringsync/musicxml'
import ToneLib from '../lib/ToneLib'
import { note, notesToMusic } from '../lib/MusicXML'

const p = ToneLib.parseNote.bind(ToneLib)

export default function SheetOSMD() {
  const xml = notesToMusic(
    [
      [
        note(p('e'), 2),
        note(p('f5'), 2, true),
        note(p('b'), 2),
      ],
      [
        note(p('e'), 2),
        note(p('f'), 2),
      ],
    ],
  )

  return <OpenSheetMusicDisplay file={xml} />
}
