import { randomViolinNote } from '../lib/ViolinNote'
import { pick } from '../lib/Random'

function Violin() {
  return <div dangerouslySetInnerHTML={{__html: pick(randomViolinNote())[1]}} />
}

export default Violin
