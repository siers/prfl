import { directRangeClamp, zipWithIndex } from './Array'

export function randInt(from: number, to: number) {
  return from + Math.floor(Math.random() * (to - from + 1))
}

export function pick<A>(array: A[]): A {
  return array[randInt(0, array.length - 1)]
}

export function shuffleArray<A>(array: A[]) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1))
    var temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
  return array
}

function surroundingIndices<A>(array: A[], index: number, distance: number) {
  return [
    directRangeClamp(0, array.length - 1, index - distance, index - 1),
    directRangeClamp(0, array.length - 1, index + 1, index + distance),
  ].flat()
}

// for 100 items, it can't find a solution with min = 3...
// pretty weak, perhaps the problem is too hard as such
// input: array: [(index, item)]
// design idea: generate N solutions, count violations, pick best ones, attempt to repair
export function shuffleMinDistanceIndexed<A>(array: [number, A][], min: number) {
  const maxAttempts = 100000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = shuffleArray(array)

    var isValid = true
    for (let i = 0; i < shuffled.length; i++) {
      const indices = surroundingIndices(shuffled, i, min)
      for (let jj = 0; jj < indices.length; jj++) {
        const j = indices[jj]
        isValid = isValid && Math.abs(shuffled[i][0] - shuffled[j][0]) > min

        if (!isValid) break
      }

      if (!isValid) break
    }

    if (isValid) {
      return shuffled.map(([_i, x]) => x)
    }
  }

  // playing with fire here
  return shuffleMinDistanceIndexed(array, min - 1)
}

export function shuffleMinDistance<A>(array: A[], min: number) {
  return shuffleMinDistanceIndexed(zipWithIndex(array), min)
}

export function maybeReverse<A>(a: A[]): A[] {
  return randInt(0, 1) == 0 ? a : a.toReversed()
}

// A `Math.random` stand-in with a fixed sequence per seed (mulberry32), for
// reproducible tests and examples.
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Past picks per key, oldest first.
export type ChoiceStats<K, A> = Map<K, A[]>

// Fair, non-repeating preference order for `key`: least-picked first, the
// previous pick last (unless it is the only option), ties shuffled.
export function balanceOrder<K, A>(stats: ChoiceStats<K, A>, key: K, available: A[]): A[] {
  const past = stats.get(key) ?? []
  const count = (a: A) => past.filter(p => p === a).length
  const rank = (a: A) => (available.length > 1 && a === past.at(-1) ? Infinity : count(a))
  return shuffleArray([...available]).sort((a, b) => rank(a) - rank(b))
}

export function recordChoice<K, A>(stats: ChoiceStats<K, A>, key: K, choice: A): ChoiceStats<K, A> {
  return new Map(stats).set(key, [...(stats.get(key) ?? []), choice])
}

// Fair, non-repeating pick: the first of `balanceOrder`. Returns the pick and
// the stats with it recorded; `stats` is left untouched.
export function balance<K, A>(stats: ChoiceStats<K, A>, key: K, available: A[]): [A, ChoiceStats<K, A>] {
  const choice = balanceOrder(stats, key, available)[0]
  return [choice, recordChoice(stats, key, choice)]
}
