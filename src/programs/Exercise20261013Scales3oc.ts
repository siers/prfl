import type { GeneratedTag, InterpolateSubstT } from './RandomizeLangTypes'
import { desMS, forceSignZero, metroS, modeShifts, range, s, shiftsMD, shuffle, ss } from './RandomizeLangUtils'

// The S-3oc card: three-octave scales in a key, with a subdivision, a starting
// offset into it, a metronome and the shifts for the first mode.
//
// A multi-tag source, next to the frozen key it reads:
// `S-3oc: [keyz]key:freeze:inline [ExScales3oc.tags(fields, rotating)]`

export type Fields = Record<string, InterpolateSubstT>

// The values a tag offers, given the tags resolved before it.
export type TagGen = (fields: Fields) => InterpolateSubstT

export const gens = {
  div: () => s(`1 2 3 4 5 6 8 9 12`),
  offset: ({ div }) => shuffle(range(1, parseInt(div[0]))).map(o => forceSignZero(Number(o) - 1)),
  metro: () => metroS(42, 4),
  per: () => [`/`],
  tempo: ({ div, metro }) => [`${Number(div[0].match(/\d+/)![0]) * Number(metro[0])}`],
  // Every scale, with and without an `R`, dealt over the key's seven modes.
  mode: ({ key }) => shuffle(modeShifts(key[0], ss(`dia hm mm`).join(' '))),
  inv: () => s(`-421, -321, 1233-4, -1, -1-2`),
  shifts: ({ mode, inv }) => shiftsMD(mode[0], `${inv[0]}:1-2-34`, '011222233333'),
  additional: ({ mode }) => [desMS(mode[0]).additional || '-'],
} satisfies Record<string, TagGen>

// `name:flag:flag`, in card order. A tag reads only the ones before it.
const specs: `${keyof typeof gens}${'' | `:${string}`}`[] = [
  'div:show-1:inline:nonrotated',
  'offset:show-1:computed:inline',
  'metro:show-1:inline',
  'per:inline',
  'tempo:computed:inline',
  'mode:cut-semi:maxlen-80:show-4',
  'inv:inline:show-1:nonrotated',
  'shifts:computed:show-1:inline',
  'additional:computed',
]

// A 🔄 rolls every tag fresh; a rotation (`rotating`) keeps the current values
// of the rolled tags and re-derives only the `computed` ones from them.
export function tags(fields: Fields, rotating: boolean = false): GeneratedTag[] {
  const resolved: Fields = { ...fields }
  return specs.map(spec => {
    const [name, ...flags] = spec.split(':') as [keyof typeof gens, ...string[]]
    const keep = rotating && !flags.includes('computed') && fields[name] !== undefined
    resolved[name] = keep ? fields[name] : gens[name](resolved)
    return { tag: name, tags: flags, contents: resolved[name] }
  })
}
