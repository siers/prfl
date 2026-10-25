import type { GeneratedTag } from './RandomizeLangTypes'
import { Card, Fields, Gens, gensOf as scales3ocGensOf, tagsWith } from './Exercise20261013Scales3oc'
import { desMS, shiftsFingered, shiftsMD } from './RandomizeLangUtils'

// The S-3ocFingered card: S-3oc, with the shifts fingered: `2yG` is a shift of
// 2 on G from the second finger it can start from, 3 (1x 1y 1w 1z: 1 2 3 4,
// 2x 2y 2w: 2 3 4, 3x 3y: 3 4, and 4 from 4), fitted to the mode's starting
// string and fingers by the fingerizator. It takes S-3oc's `scales` and
// `modulations`; the fingerizator walks the scale a diatonic step at a time, so
// the other scales (chromatic, arpeggios, positions) keep S-3oc's shifts.
// `S-3ocFingered: [key]key:freeze:inline [ExFingered3oc.tags(fields, rotating, { scales: 'dia hm mm' })]`

const stepwise = ['dia', 'hm', 'mm']
const distrib = '011222233333'

const gensOf = (card: Card) => ({
  ...scales3ocGensOf(card),
  shifts: ({ key, target, mode, inv }) => stepwise.includes(desMS(mode[0]).scale)
    ? shiftsFingered((target ?? key)[0], mode[0], inv[0], distrib)
    : shiftsMD(mode[0], `${inv[0]}:1-2-34`, distrib),
}) satisfies Gens

export function tags(fields: Fields, rotating: boolean, card: Card): GeneratedTag[] {
  return tagsWith(gensOf(card), fields, rotating, card)
}
