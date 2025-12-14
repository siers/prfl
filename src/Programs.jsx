import Violin from './programs/Violin'
import Keys from './programs/Keys'
import Hash from './programs/Hash'
import Positions from './programs/Positions'
import Missing from './programs/Missing.tsx'
import Solfege from './programs/Solfege.tsx'
import SheetOSMD from './programs/SheetOSMD.tsx'

const programs = {
  positions: Positions,
  'random keys': Keys,
  'missing-key': Missing,
  'solfege-ambiguity': Solfege,
  hash: Hash,
  ...(window.location.host.match(/localhost/) ? {sheetosmd: SheetOSMD} : {}),
}

export default programs
