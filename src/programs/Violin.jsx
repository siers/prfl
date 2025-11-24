import { randomViolinNote } from '../lib/ViolinNote'
import { pick } from '../lib/Random'

function Violin({state, setState, advance}) {
  if (advance || !state) {
    setState(pick(randomViolinNote())[1])
  }

  return <div dangerouslySetInnerHTML={{__html: state}} />
}

export default Violin
