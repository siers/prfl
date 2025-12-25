import * as ToneLib from '../lib/ToneLib'
import { shuffleArray } from '../lib/Random'
import { fromProducer } from '../lib/Program'
import { chunk } from '../lib/Array'

function Missing(controls) {
  return fromProducer(controls, () => {
    const keys = shuffleArray(ToneLib.keysMajor().map(k => ToneLib.renderNote(k[0], false)))
    const [missing, ...remaining] = keys
    const presents = chunk(remaining, 4).map(c => c.join(' ')).join('<br>')
    return [presents, presents + '<br><br>' + missing]
  }, {html: true})
}

export default Missing
