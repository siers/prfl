import OpenSheetMusicDisplay from '../lib/OpenSheetMusicDisplay'

const r = await fetch('/flash-command/music.xml')
const b = await r.text()

export default function SheetOSMD() {
  return <OpenSheetMusicDisplay file={b} />
  // return <OpenSheetMusicDisplay file={b} />
}
