import type { GeneratedTag } from './RandomizeLangTypes'
import type { Fields, TagGen } from './Exercise20261013Scales3oc'
import { forceSignZero, metroS, modeShifts, range, s, shiftsFingered, shuffle } from './RandomizeLangUtils'

// The S-3ocFingered card: S-3oc's three-octave diatonic modes, with the shifts
// fingered: `2yG` is a shift of 2 on G from the second finger it can start
// from, 3 (1x 1y 1w 1z: 1 2 3 4, 2x 2y 2w: 2 3 4, 3x 3y: 3 4, and 4 from 4),
// fitted to the mode's starting string and fingers by the fingerizator.
// `S-3ocFingered: [key]key:freeze:inline [ExFingered3oc.tags(fields, rotating)]`

const gens = {
  div: () => s(`1 2 3 4 5 6 8 9 12`),
  offset: ({ div }) => shuffle(range(1, parseInt(div[0]))).map(o => forceSignZero(Number(o) - 1)),
  metro: () => metroS(42, 4),
  per: () => [`/`],
  tempo: ({ div, metro }) => [`${Number(div[0]) * Number(metro[0])}`],
  mode: ({ key }) => shuffle(modeShifts(key[0], 'dia')),
  inv: () => s(`-421, -321, 1233-4, -1, -1-2`),
  shifts: ({ key, mode, inv }) => shiftsFingered(key[0], mode[0], inv[0], '011222233333'),
} satisfies Record<string, TagGen>

type Spec = `${keyof typeof gens}${'' | `:${string}`}`

// `name:flag:flag`, in card order. A tag reads only the ones before it.
const specs: Spec[] = [
  'div:show-1:inline:nonrotated',
  'offset:show-1:computed:inline',
  'metro:show-1:inline',
  'per:inline',
  'tempo:computed:inline',
  'mode:cut-semi:maxlen-80:show-4',
  'inv:inline:show-1:nonrotated',
  'shifts:computed:show-1:inline',
]

// As in ExScales3oc: a 🔄 rolls every tag fresh; a rotation keeps the rolled
// tags and re-derives only the `computed` ones.
export function tags(fields: Fields, rotating: boolean): GeneratedTag[] {
  const isName = (n: string): n is keyof typeof gens => Object.hasOwn(gens, n)
  const resolved: Fields = { ...fields }
  return specs.flatMap(spec => {
    const [name, ...flags] = spec.split(':')
    if (!isName(name)) return []
    const keep = rotating && !flags.includes('computed') && fields[name] !== undefined
    resolved[name] = keep ? fields[name] : gens[name](resolved)
    return [{ tag: name, tags: flags, contents: resolved[name] }]
  })
}
