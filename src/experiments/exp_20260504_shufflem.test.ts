import { expect, test } from 'vitest'
import _ from 'lodash'
import { checkIsShuffledMinD, shuffleMI } from './exp_20260504_shufflem'

test('checkIsShuffledMinD', () => {
  expect(checkIsShuffledMinD(0, [])).toStrictEqual(true)
  expect(checkIsShuffledMinD(1, [])).toStrictEqual(true)

  expect(checkIsShuffledMinD(1, [0, 2,])).toStrictEqual(true)
  expect(checkIsShuffledMinD(1, [3, 2,])).toStrictEqual(false)
})

// test('shuffleMI', () => {
//   const a: string[] = 'abcdefhi'.split('')
//   const dists: number[] = [0, 1, 2, 3, 4]
//   dists.forEach(distance => {
//     const out = shuffleMI(distance, a)
//     console.log(distance, JSON.stringify(out))
//     expect(out.map(a => a[1])).not.toStrictEqual(a)
//     expect(out.length).toStrictEqual(a.length)
//     expect(checkIsShuffledMinD(distance, out.map(a => a[0]))).toStrictEqual(true)
//   })
// })
