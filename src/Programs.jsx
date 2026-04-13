import Positions from './programs/Positions'
import SheetOSMD from './programs/SheetOSMD.tsx'
import Jcuken from './programs/Jcuken.tsx'
import Flash from './programs/Flash.tsx'
import Randomize from './programs/Randomize.tsx'
import { isDev } from './debug.js'

const programs = {
  positions: Positions,
  jcuken: Jcuken,
  flash: Flash,
  randomize: Randomize,
  ...(isDev ? { sheetosmd: SheetOSMD } : {}),
}

export default programs
