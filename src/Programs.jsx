import Violin from './programs/Violin'
import Keys from './programs/Keys'
import Hash from './programs/Hash'
import Positions from './programs/Positions'
import Missing from './programs/Missing.tsx'
import Solfege from './programs/Solfege.tsx'

const programs = {
  violin: Violin,
  keys: Keys,
  hash: Hash,
  positions: Positions,
  'missing-key': Missing,
  'solfege-ambiguity': Solfege,
}

export default programs
