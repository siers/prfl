import { expect, test, describe } from 'vitest'
import { hm, ms, freshTimer, freshTimerOrRestart, toStoppedTimer, toStartedTimer, timerLength, logicalTimerLength, timerSubtract } from './Timers.js'

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

describe('logicalTimerLength', () => {
  test('null returns 0', () => {
    expect(logicalTimerLength(null, 5000)).toBe(0)
  })

  test('running timer returns elapsed ms', () => {
    expect(logicalTimerLength(freshTimer(1000), 3000)).toBe(2000)
  })

  test('stopped timer returns recorded length in ms', () => {
    expect(logicalTimerLength(toStoppedTimer(freshTimer(1000), 4000), 9999)).toBe(3000)
  })
})

describe('timerSubtract', () => {
  test('subtracts running from stopped', () => {
    const a = toStoppedTimer(freshTimer(0), 5000)   // 5000ms
    const b = freshTimer(8000)                       // 2000ms elapsed at now=10000
    expect(timerSubtract(a, b, 10000)).toStrictEqual({ kind: 'stopped', length: 3000, running: false })
  })

  test('subtracts stopped from stopped', () => {
    const a = toStoppedTimer(freshTimer(0), 5000)   // 5000ms
    const b = toStoppedTimer(freshTimer(0), 2000)   // 2000ms
    expect(timerSubtract(a, b, 0)).toStrictEqual({ kind: 'stopped', length: 3000, running: false })
  })

  test('subtracts stopped from running → stays running, virtual start adjusted', () => {
    const a = freshTimer(0)                          // 10000ms elapsed at now=10000
    const b = toStoppedTimer(freshTimer(0), 3000)   // 3000ms
    // result = 7000ms running → virtual start = 10000 - 7000 = 3000
    expect(timerSubtract(a, b, 10000)).toStrictEqual({ kind: 'started', start: 3000, running: true })
  })

  test('clamps to 0 when minus exceeds t (stopped)', () => {
    const a = toStoppedTimer(freshTimer(0), 1000)   // 1000ms
    const b = toStoppedTimer(freshTimer(0), 5000)   // 5000ms
    expect(timerSubtract(a, b, 0)).toStrictEqual({ kind: 'stopped', length: 0, running: false })
  })

  test('clamps to 0 when minus exceeds t (running)', () => {
    const a = freshTimer(9000)                       // 1000ms elapsed at now=10000
    const b = toStoppedTimer(freshTimer(0), 5000)   // 5000ms
    // clamped to 0 → virtual start = now
    expect(timerSubtract(a, b, 10000)).toStrictEqual({ kind: 'started', start: 10000, running: true })
  })

  test('undefined minus is a no-op', () => {
    const a = toStoppedTimer(freshTimer(0), 4000)
    expect(timerSubtract(a, undefined, 0)).toStrictEqual({ kind: 'stopped', length: 4000, running: false })
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
