import { roundToNaive } from '../lib/Math.js'

export type Timer = { kind: 'started', start: number, running: true } | { kind: 'stopped', length: number, running: false }
export type Timers = (Timer | null)[]

//

export function padRight(str: string, size: number, with_: string): string {
  var s = str
  while (s.length < size) s = with_ + s
  return s
}

export function hm(a: number): string {
  const h = Math.floor(a / 60)
  const m = roundToNaive(a % 60, 2)
  const mPad = padRight('' + m, 2, '0')
  return h == 0 ? `${m}m` : `${h}h${mPad}`
}

export function ms(a: number): string {
  const h = Math.floor(a / 3600)
  const m = Math.floor((a / 60) % 60)
  const s = roundToNaive(a % 60, 2).toFixed(2)
  const mPad = padRight('' + m, 2, '0')
  const sPad = padRight(s, 5, '0')
  return h != 0
    ? `${h}h${mPad}m${sPad}`
    : m != 0
      ? `${m}m${sPad}`
      : `${s}s`
}

//

export const freshTimer: (start: number) => Timer = (start: number) => ({ kind: 'started', start, running: true })

export const freshTimerOrRestart: (start: number, t: Timer | null) => Timer =
  (start: number, t: Timer | null) => {
    if (t?.running != false) return ({ kind: 'started', start, running: true })
    else return ({ kind: 'stopped', length: 0, running: false })
  }

export const toStoppedTimer: (t: Timer, stop: number) => Timer = (t: Timer, stop: number) => {
  if (t.kind == 'stopped') return t
  if (t.kind == 'started') return ({ kind: 'stopped', length: stop - t.start, running: false })
  return freshTimer(0) // t.kind is `never` here
}

export const toStartedTimer: (t: Timer, start: number) => Timer = (t: Timer, start: number) => {
  if (t.kind == 'started') return t
  if (t.kind == 'stopped') return freshTimer(start - t.length)
  return freshTimer(0) // t.kind is `never` here
}

export const timerSubtract: (t: Timer, minus: Timer | null | undefined, now: number) => Timer = (t: Timer, minus: Timer | null | undefined, now: number) => {
  const tMs = logicalTimerLength(t, now)
  const minusMs = minus ? logicalTimerLength(minus, now) : 0
  const resultMs = Math.max(0, tMs - minusMs)
  return { kind: 'stopped', length: resultMs, running: false }
}

export function logicalTimerLength(t: Timer | null, now: number): number {
  if (!t) return 0
  if (t.kind == 'started') return now - t.start
  if (t.kind == 'stopped') return t.length
  return 0
}

export function timerLength(t: Timer | null, now: number): number {
  return logicalTimerLength(t, now) / 1000
}
