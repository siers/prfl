import * as ToneLib from '../lib/ToneLib'
import { shuffleArray } from '../lib/Random'
import { fromProducer, select } from '../lib/Program'
import { chunk } from '../lib/Array'

function Keys(controls) {
  return (
    <>
      <div className="controls">
        chunk: {select(controls, 'chunks', [1, 2, 3, 4, 5, 6])}
      </div>

      {fromProducer(controls, () => {
        const keys = ToneLib.keysMajor().map(k => k[0].render)
        const chunkSize = parseInt(controls.state?.chunks || 1)
        return chunk(shuffleArray(keys), chunkSize).map(ks => ks.join(', '))
      })}
    </>
  )
}

export default Keys
