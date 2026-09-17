import _ from 'lodash'
import * as Comb from 'ts-combinatorics'
import { chunk, zipLongest } from '../lib/Array'
import { shuffleArray } from '../lib/Random'

export type Bowing = 'n' | 'v'

const BOWINGS: Bowing[] = ['n', 'v']

const SETS = ['1110', '1100', '0001']

const PER_BAR = 2

const arrangements = (bits: string): string[] =>
  _.uniq([...new Comb.Permutation([...bits])].map(p => p.join(''))).sort()

const bowedBar = (bits: string, bowings: Bowing[] = BOWINGS): string =>
  [...bits].map((bit, i) =>
    `c8${bowings[i % bowings.length]}${bit == '0' ? '[x]' : ''}`).join(' ')

export const gen = (sets: string[] = SETS): string[] =>
  chunk(zipLongest(...sets.map(bits => shuffleArray(arrangements(bits)))).flat(), PER_BAR)
    .filter(pair => pair.length == PER_BAR)
    .map(pair => bowedBar(pair.join('')))

export const internals = { arrangements, bowedBar }
