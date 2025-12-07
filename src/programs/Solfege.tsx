import { fromProducer } from '../lib/Program'
import { shuffleArray } from '../lib/Random'

export default function (controls) {
  return fromProducer(controls, () => shuffleArray(['D', 'C', 'G', 'B', '♣️', '♠️', '♥️', '♦️']))
}
