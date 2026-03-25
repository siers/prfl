import { expect, test } from 'vitest'
import { hm, ms } from './Timers.js'

test('hm', () => {
  expect(hm(1)).toStrictEqual('1m')
  expect(hm(60)).toStrictEqual('1h00')
  expect(hm(90)).toStrictEqual('1h30')
})

test('ms', () => {
  expect(ms(1)).toStrictEqual('1.00s')
  expect(ms(59.4444)).toStrictEqual('59.44s')
  expect(ms(60)).toStrictEqual('1m00.00')
  expect(ms(3600)).toStrictEqual('1h00m00.00')
})
