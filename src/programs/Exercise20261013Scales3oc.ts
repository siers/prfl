import { modulateModalKeyString, modulations } from '../lib/ToneLib'
import type { Modulation } from '../lib/ToneLib'
import type { GeneratedTag, InterpolateSubstT } from './RandomizeLangTypes'
import { desMS, forceSignZero, metroS, modeShifts, range, s, shiftsMD, shuffle } from './RandomizeLangUtils'

// The S-3oc card: three-octave scales in a key, with a subdivision, a starting
// offset into it, a metronome and the shifts for the first mode.
//
// A multi-tag source next to the frozen key it reads. The card hands in the
// scales to deal over the key's modes, and optionally modulations: then the
// modes are dealt in the key moved by one of them. Both are split like `s()`
// splits: on commas if there are any, else spaces, else into characters — so a
// single scale needs its trailing comma, `dia,`.
// `S-3oc: [keyz]key:freeze:inline [ExScales3oc.tags(fields, rotating, { scales: 'dia hm mm' })]`
// `S-3oc-near: [keyz]key:freeze:inline [ExScales3oc.tags(fields, rotating, { scales: 'dia,', modulations: '-1, +1, +6, sub' })]`

export type Fields = Record<string, InterpolateSubstT>

// The values a tag offers, given the tags resolved before it.
export type TagGen = (fields: Fields) => InterpolateSubstT

export type Card = { scales: string, modulations?: string }

const isModulation = (m: string): m is Modulation => Object.hasOwn(modulations, m)

export const gensOf = ({ scales, modulations = '' }: Card) => ({
  modulation: () => shuffle(s(modulations).filter(isModulation)),
  // `key` moved by the modulation; `-` when it can't be.
  target: ({ key, modulation }) => {
    const mod = modulation[0]
    return [(isModulation(mod) && modulateModalKeyString(key[0], mod)) || '-']
  },
  div: () => s(`1 2 3 4 5 6 8 9 12`),
  offset: ({ div }) => shuffle(range(1, parseInt(div[0]))).map(o => forceSignZero(Number(o) - 1)),
  metro: () => metroS(42, 4),
  per: () => [`/`],
  tempo: ({ div, metro }) => [`${Number(div[0].match(/\d+/)![0]) * Number(metro[0])}`],
  // The `scales`, dealt over the seven modes of the moved key, else the key.
  mode: ({ key, target }) => shuffle(modeShifts((target ?? key)[0], s(scales).join(' '))),
  inv: () => s(`-421, -321, 1233-4, -1, -1-2`),
  shifts: ({ mode, inv }) => shiftsMD(mode[0], `${inv[0]}:1-2-34`, '011222233333'),
  additional: ({ mode }) => [desMS(mode[0]).additional || '-'],
}) satisfies Record<string, TagGen>

export type Gens = ReturnType<typeof gensOf>

type Spec = `${keyof Gens}${'' | `:${string}`}`

// `name:flag:flag`, in card order. A tag reads only the ones before it.
const modulationSpecs: Spec[] = [
  'modulation:inline:show-1:nonrotated',
  'target:computed:inline',
]
const specs: Spec[] = [
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

// The card's tags, each made by its generator from the tags before it. A 🔄
// rolls every tag fresh; a rotation (`rotating`) keeps the current values of
// the rolled tags and re-derives only the `computed` ones from them.
export function tags(fields: Fields, rotating: boolean, card: Card): GeneratedTag[] {
  return tagsWith(gensOf(card), fields, rotating, card)
}

// `tags`, made by other generators for the same tags: a card varying S-3oc.
export function tagsWith(gens: Gens, fields: Fields, rotating: boolean, card: Card): GeneratedTag[] {
  const isName = (n: string): n is keyof typeof gens => Object.hasOwn(gens, n)
  const resolved: Fields = { ...fields }
  return [...(card.modulations ? modulationSpecs : []), ...specs].flatMap(spec => {
    const [name, ...flags] = spec.split(':')
    if (!isName(name)) return []
    const keep = rotating && !flags.includes('computed') && fields[name] !== undefined
    resolved[name] = keep ? fields[name] : gens[name](resolved)
    return [{ tag: name, tags: flags, contents: resolved[name] }]
  })
}
