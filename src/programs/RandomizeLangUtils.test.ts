import { describe, expect, test } from 'vitest'
import { randomizeLangUtils } from './RandomizeLangUtils'
import _ from 'lodash'

const {
  s,
  cross,
  times,
  parts,
  divide,
  indexPyramid,
  phrasePyramid,
  j,
  jj,
  zip,
  zipInterleave,
  shuffle,
  interleavingEvery,
  after,
} = randomizeLangUtils(new Map(), new Map())

test('s', () => {
  expect(s('')).toStrictEqual([])
  expect(s('GDAE')).toStrictEqual(['G', 'D', 'A', 'E'])
  expect(s('one two three')).toStrictEqual(['one', 'two', 'three'])
  expect(s('one two, three four')).toStrictEqual(['one two', 'three four'])

  expect(s('a,b,')).toStrictEqual(['a', 'b'])
})

test('cross', () => {
  expect(cross('12 x ab')).toStrictEqual(s('1a 1b 2a 2b'))
})

test('times', () => {
  expect(times(3, 'f')).toStrictEqual(['f', 'f', 'f'])
  expect(times(3, x => (x || 0) + 1)).toStrictEqual([1, 2, 3])
})

test('parts', () => {
  // expect(parts(4)).toStrictEqual(['0%', '25%', '50%', '75%'])
  // expect(parts(4, 10)).toStrictEqual(['10%', '35%', '60%', '85%'])
  // expect(parts(4)).toStrictEqual('1/4 2/4 3/4 4/4'.split(' '))
  // expect(parts(4, 1)).toStrictEqual('2/4 3/4 4/4 1/4'.split(' '))
  expect(parts(4)).toStrictEqual('1 2 3 4'.split(' '))
  expect(parts(4, 1)).toStrictEqual('2 3 4 1'.split(' '))
})

test('divide', () => {
  expect(divide([], 2)).toStrictEqual([[], []])
  expect(divide([1], 2)).toStrictEqual([[1], []])
  expect(divide([1], 5)).toStrictEqual([[1], [], [], [], []])
  expect(divide([1, 2], 5)).toStrictEqual([[1], [2], [], [], []])
  expect(divide([1, 2, 3], 2)).toStrictEqual([[1, 2], [3]])
  expect(divide([1, 2, 3, 4], 3)).toStrictEqual([[1], [2], [3, 4]])
  expect(divide([1, 2, 3, 4, 5], 5)).toStrictEqual([[1], [2], [3], [4], [5]])
  expect(divide([1, 2, 3, 4, 5], 2)).toStrictEqual([[1, 2, 3], [4, 5]])
  expect(divide([1, 2, 3, 4, 5, 6, 7, 8], 3)).toStrictEqual([[1, 2, 3], [4, 5, 6], [7, 8]])
  expect(divide([1, 2, 3, 4, 5, 6, 7, 8, 9], 3)).toStrictEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9]])
  expect(divide([1, 2, 3, 4, 5, 6, 7, 8, 9], 2)).toStrictEqual([[1, 2, 3, 4, 5], [6, 7, 8, 9]])
})

// test('partChunks', () => {
//   expect(partChunks(5, 2)).toStrictEqual([['0%', '20%'], ['40%', '60%', '80%']])
//   expect(mj(partChunks(5, 2))).toStrictEqual(['0% 20%', '40% 60% 80%'])
// })

test('indexPyramid', () => {
  const predistrib = indexPyramid(5).flat().flat()
  const freq = _.countBy(predistrib, x => x)

  expect(freq).toStrictEqual({
    "0": 15,
    "1": 15,
    "2": 15,
    "3": 15,
    "4": 15,
  })
})

test('phrasePyramid', () => {
  {
    const inp = '1 2 3'
    const out = '[1], [2], [3] | [1 2], [2 3], [3 1] | [1.3], [2.1], [3.2]'
    expect(phrasePyramid(inp)).toStrictEqual(out.split(/ *\| */).map(x => x.split(/, */)))
  }

  {
    const inp = '1 2 3 4'
    const out = '[1], [2], [3], [4] | [1 2], [2 3], [3 4], [4 1] | [1.3], [2.4], [3.1], [4.2] | [1.4], [2.1], [3.2], [4.3]'
    expect(phrasePyramid(inp)).toStrictEqual(out.split(/ *\| */).map(x => x.split(/, */)))
  }
})

// test('phrasePyramid counts', () => {
//   const inp = '1 2 3'
//   expect(_.countBy(phrasePyramid(inp), x => x)).toStrictEqual([])
// })

test('shuffle', () => {
  const long = 'kdnwjertnblrekjnfqlekjfnqlkewjfnqwelkjfnqwelkjnfq'

  expect(shuffle(s('a'))).toStrictEqual(s('a'))
  expect(Array(...shuffle(s(long))).toSorted()).toStrictEqual(Array(...s(long)).toSorted())
  expect(shuffle(s(long))).not.toStrictEqual(s(long))
})

test('zip', () => {
  expect(zip(s('123'), s('ab'))).toStrictEqual(['1a', '2b'])
  expect(zip(s('ab'), s('123'))).toStrictEqual(['a1', 'b2'])
})

test('zipInterleave', () => {
  expect(zipInterleave(s('1 2 3'), s('a b c'))).toStrictEqual(s('1 a 2 b 3 c'))
  expect(zipInterleave(s('1 2 3 4 5 6'), s('a b c'))).toStrictEqual(s('1 2 a 3 4 b 5 6 c'))
  expect(zipInterleave(s('a b c'), s('1 2 3 4 5 6'))).toStrictEqual(s('a 1 2 b 3 4 c 5 6'))
})

test('j & jj', () => {
  expect(j([1, 2])).toStrictEqual('1 2')
  expect(jj([[1, 2], [3, 4]])).toStrictEqual('1 2, 3 4')
})

describe('pickMemK', () => {
  type Memory = Map<string, any>
  type Sig =
    (m: Memory, key: string | undefined, array: any[] | string, n: number | undefined, stats: any)
      => [string[], Memory]

  const pmk: Sig = (m, a, b, c, d) => [randomizeLangUtils(new Map(), m).pickMemK(a, b, c, d), m]

  test('basic', () => {
    const m: Memory = new Map()
    expect(pmk(m, '', '1', 1, undefined)).toEqual([["1"], m])
  })

  test('make a key if it is missing', () => {
    const m: Memory = new Map([["1||2", { "2": 1 }]])
    expect(pmk(m, '', '12', 1, undefined)).toEqual([["1"], m])
  })

  test('favors oldest', () => {
    const counts: Record<string, number> = {}
    for (let i = 0; i < 200; i++) {
      const m: Memory = new Map([["k", { "b": 1 }]])
      const [picked] = pmk(m, 'k', 'ab', 1, undefined)
      counts[picked[0]] = (counts[picked[0]] || 0) + 1
    }
    // "a" (unknown/oldest) should be picked much more often than "b"
    expect(counts['a']).toBeGreaterThan(counts['b'] || 0)
  })

  test('stale keys in stats are ignored', () => {
    const stale = { "x1": -1, "x2": -1, "x3": -1, "x4": -1, "x5": -1, "x6": -1, "x7": -1, "a": 1 }
    const m: Memory = new Map([["k", stale]])
    const [picked] = pmk(m, 'k', 'ab', 1, undefined)
    // "b" is unknown (oldest), "a" has order 1 (newest), stale x1-x7 not in items
    // only "b" should be pickable (past-middle = 0 weight, and there's only 2 items)
    expect(picked[0]).toEqual("b")
  })

  test('update stats', () => {
    const m: Memory = new Map([["stuff", { "b": 1 }]])
    pmk(m, 'stuff', 'ab', 1, undefined)
    const stats = m.get('stuff')
    // whichever was picked should have the highest order
    const picked = Object.entries(stats).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0]
    expect(stats[picked]).toEqual(2)
  })

  test('stale keys preserved and items coming back retain history', () => {
    const m: Memory = new Map()
    // pick from a b c
    pmk(m, 'k', 'abc', 3, undefined)
    const statsAfterFirst = { ...m.get('k') }
    // now only a c are active - b is gone
    pmk(m, 'k', 'ac', 2, undefined)
    // b's stats should still be in memory (not wiped)
    expect(m.get('k')['b']).toEqual(statsAfterFirst['b'])
    // bring b back - it retains its old order, not treated as brand new
    const bOrderBefore = m.get('k')['b']
    pmk(m, 'k', 'abc', 0, undefined)
    expect(m.get('k')['b']).toEqual(bOrderBefore)
  })
})

test('interleavingEvery', () => {
  expect(interleavingEvery(s('1 2 3'), s('a'), 2)).toStrictEqual(s('1 2 a 3'))
  expect(interleavingEvery(s('1 2 3 4'), s('a'), 2)).toStrictEqual(s('1 2 a 3 4 a'))
})

test('after', () => {
  expect(after('2020-01-01', ['a', 'b'])).toStrictEqual(['a', 'b'])
  expect(after('2099-01-01', ['a', 'b'])).toStrictEqual([])
  expect(after('2020-01-01', 'solo')).toStrictEqual(['solo'])
})
