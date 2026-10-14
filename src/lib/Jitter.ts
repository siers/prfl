import _ from 'lodash'

// Full jitter strength is reached once closeness-to-center × gain hits 1; below
// 1 it never is, and the middle peaks at `gain` strength. 0.7 keeps the first
// and last items in place about 80-85% of the time.
export const DEFAULT_JITTER_GAIN = 0.7

// Small lists barely reorder at a gain that keeps the ends still, so the gain is
// multiplied by 1 + SMALL_LIST_BOOST × e^(-(length - 3) / SMALL_LIST_DECAY):
// ×1.7 at 3 items, ×1.3 at 4, ×1.18 at 5, fading out by 8. A 4-item list then
// reorders about half the time instead of about a quarter.
const SMALL_LIST_BOOST = 0.7
const SMALL_LIST_DECAY = 1.5

// With the default gain, a 20-item list moves items about 1.6 places on
// average, at most 8.
export const DEFAULT_JITTER_PERCENT = 100

// Reorders `as` by nudging each item's index by up to ±spread/2 and sorting,
// where spread = ceil(spreadPercent% of the length), so no item moves `spread`
// or more places. The nudge is scaled by min(1, closenessToCenter × gain),
// closeness running from 1 in the middle to 0 one step past either end, so the
// ends move least. Short lists get a boosted gain (see SMALL_LIST_BOOST).
// `random` is injectable for seeded tests.
export function jitter<A>(
  as: A[],
  spreadPercent: number = DEFAULT_JITTER_PERCENT,
  gain: number = DEFAULT_JITTER_GAIN,
  random: () => number = Math.random
): A[] {
  const spread = Math.ceil(as.length * spreadPercent / 100)
  const center = (as.length - 1) / 2
  const boostedGain = gain * (1 + SMALL_LIST_BOOST * Math.exp(-(as.length - 3) / SMALL_LIST_DECAY))

  const keyed = as.map((a, index) => {
    const closeness = 1 - Math.abs(index - center) / (center + 1)
    const strength = Math.min(1, closeness * boostedGain)
    return { a, key: index + (random() - 0.5) * spread * strength }
  })

  return _.sortBy(keyed, 'key').map(({ a }) => a)
}
