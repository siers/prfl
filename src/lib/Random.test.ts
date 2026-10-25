import { describe, expect, test } from 'vitest'
import { balance, ChoiceStats } from './Random.tsx'

describe('balance', () => {
  const run = (n: number, available: number[]): [number[], ChoiceStats<string, number>] => {
    let stats: ChoiceStats<string, number> = new Map()
    const picks: number[] = []
    for (let i = 0; i < n; i++) {
      const [choice, next] = balance(stats, 'k', available)
      picks.push(choice)
      stats = next
    }
    return [picks, stats]
  }

  test('picks evenly', () => {
    const [picks] = run(12, [1, 2, 3])
    expect([1, 2, 3].map(a => picks.filter(p => p == a).length)).toStrictEqual([4, 4, 4])
  })

  test('never repeats the previous pick', () => {
    const [picks] = run(50, [1, 2])
    picks.slice(1).forEach((p, i) => expect(p).not.toBe(picks[i]))
  })

  test('repeats when there is only one option', () => {
    expect(run(3, [4])[0]).toStrictEqual([4, 4, 4])
  })

  test('records the pick under its key, leaving the input stats alone', () => {
    const stats: ChoiceStats<string, number> = new Map([['other', [1]]])
    const [choice, next] = balance(stats, 'k', [7])
    expect(choice).toBe(7)
    expect([...next]).toStrictEqual([['other', [1]], ['k', [7]]])
    expect(stats.has('k')).toBe(false)
  })
})
