import { expect, test, describe } from 'vitest'
import { hm, ms, freshTimer, freshTimerOrRestart, toStoppedTimer, toStartedTimer, timerLength } from './Timers.js'

describe('hm', () => {
  test('minutes only', () => { expect(hm(1)).toStrictEqual('1m') })
  test('hours and zero minutes', () => { expect(hm(60)).toStrictEqual('1h00') })
  test('hours and minutes', () => { expect(hm(90)).toStrictEqual('1h30') })
})

describe('ms', () => {
  test('seconds only', () => { expect(ms(1)).toStrictEqual('1.00s') })
  test('seconds with decimals', () => { expect(ms(59.4444)).toStrictEqual('59.44s') })
  test('minutes and seconds', () => { expect(ms(60)).toStrictEqual('1m00.00') })
  test('hours minutes seconds', () => { expect(ms(3600)).toStrictEqual('1h00m00.00') })
})

describe('freshTimer', () => {
  test('returns a started timer at given timestamp', () => {
    expect(freshTimer(1000)).toStrictEqual({ kind: 'started', start: 1000, running: true })
  })
})

describe('freshTimerOrRestart', () => {
  test('null input starts a fresh timer', () => {
    expect(freshTimerOrRestart(1000, null)).toStrictEqual({ kind: 'started', start: 1000, running: true })

    const running = freshTimer(500)
    expect(freshTimerOrRestart(1000, running)).toStrictEqual({ kind: 'started', start: 1000, running: true })
  })

  test('stopped timer returns zero-length stopped timer', () => {
    const stopped = toStoppedTimer(freshTimer(0), 2000)
    expect(freshTimerOrRestart(1000, stopped)).toStrictEqual({ kind: 'stopped', length: 0, running: false })
  })
})

describe('toStoppedTimer', () => {
  test('stops a running timer, recording elapsed ms', () => {
    expect(toStoppedTimer(freshTimer(1000), 3000)).toStrictEqual({ kind: 'stopped', length: 2000, running: false })
  })

  test('no-op on an already stopped timer', () => {
    const stopped = toStoppedTimer(freshTimer(1000), 3000)
    expect(toStoppedTimer(stopped, 5000)).toStrictEqual({ kind: 'stopped', length: 2000, running: false })
  })
})

describe('toStartedTimer', () => {
  test('resumes a stopped timer, adjusting virtual start to preserve elapsed', () => {
    // 2000ms elapsed, resumed at t=5000 → virtual start = 5000 - 2000 = 3000
    const stopped = toStoppedTimer(freshTimer(1000), 3000)
    expect(toStartedTimer(stopped, 5000)).toStrictEqual({ kind: 'started', start: 3000, running: true })
  })

  test('no-op on an already started timer', () => {
    const running = freshTimer(1000)
    expect(toStartedTimer(running, 9000)).toStrictEqual({ kind: 'started', start: 1000, running: true })
  })
})

describe('timerLength', () => {
  test('null timer returns 0', () => {
    expect(timerLength(null, 5000)).toBe(0)
  })

  test('running timer returns elapsed seconds', () => {
    expect(timerLength(freshTimer(1000), 3000)).toBe(2)
  })

  test('stopped timer returns recorded length in seconds', () => {
    expect(timerLength(toStoppedTimer(freshTimer(1000), 4000), 9999)).toBe(3)
  })
})

describe('start / stop / restart cycle', () => {
  test('accumulates elapsed time across stop and resume', () => {
    const started = freshTimer(0)
    const stopped = toStoppedTimer(started, 2000)           // 2s elapsed
    const resumed = toStartedTimer(stopped, 5000)           // virtual start = 3000
    const stopped2 = toStoppedTimer(resumed, 8000)          // 5s total
    expect(stopped2).toStrictEqual({ kind: 'stopped', length: 5000, running: false })
    expect(timerLength(stopped2, 0)).toBe(5)
  })
})
