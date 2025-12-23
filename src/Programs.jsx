import Violin from './programs/Violin'
import Keys from './programs/Keys'
import Positions from './programs/Positions'
import Missing from './programs/Missing.tsx'
import Solfege from './programs/Solfege.tsx'
import SheetOSMD from './programs/SheetOSMD.tsx'
import Jcuken from './programs/Jcuken.tsx'
import Flash from './programs/Flash.tsx'
import Randomize from './programs/Randomize.tsx'
import { isDev } from './debug.js'

const programs = {
  positions: Positions,
  'random keys': Keys,
  'missing-key': Missing,
  'solfege-ambiguity': Solfege,
  jcuken: Jcuken,
  flash: Flash,
  randomize: Randomize,
  ...(isDev ? {sheetosmd: SheetOSMD} : {}),
}

export default programs
