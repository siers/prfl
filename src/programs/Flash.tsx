import ToneLib from '../lib/ToneLib'
import { shuffleArray } from '../lib/Random'
import { prepareNext } from '../lib/Program'
import { chunk } from '../lib/Array'
import FlashList from './FlashList.js'

// % jq -R -n -c '[inputs]' <(find public/ -type f | sed 's:^public/::') | sed 's/^/export default /; s:^:/* automatically generated, don'\''t touch */ :' > src/programs/FlashList.js
// console.log('FlashList', FlashList)

function Flash(controls) {
  prepareNext(controls, () => shuffleArray(FlashList))

  const next = controls?.state?.next?.at(0)

  return (
    <>
      {next && <img src={next} />}
    </>
  )
}

export default Flash
