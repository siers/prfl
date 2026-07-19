export function chunk<A>(arr: A[], len: number) {
  var chunks = [], i = 0, n = arr.length;
  while (i < n) chunks.push(arr.slice(i, i += len))
  return chunks
}

// forwards only
export function directRange(start: number, stop: number): number[] {
  if (start > stop)
    return []
  else
    return Array(stop - start + 1).fill(start).map((x, y) => x + y)
}

export function directRangeClamp(min: number, max: number, start: number, stop: number) {
  return directRange(Math.max(min, start), Math.min(max, stop))
}

export function times(n: number): any[] {
  return directRange(1, n)
}

export function zipWithIndex<A>(as: A[]): [number, A][] {
  return as.map((x, i) => [i, x])
}

export function indices<A>(as: A[]): number[] {
  return as.map((_, i) => i)
}

export function reorderIndices<A>(lines: A[], indices: number[]) {
  return indices.map(i => lines[i])
}

export const intersperse = <A>(arr: A[], sep: A) => arr.reduce((a, v) => [...a, v, sep], [] as A[]).slice(0, -1)
export const interspersing = <A>(arr: A[], sep: A[]) => arr.reduce((a, v) => [...a, v, ...sep], [] as A[]).slice(0, -(sep.length))

export function zipT<A>(...ass: A[][]): A[][] {
  return ass.slice(0, 1).flatMap(fs =>
    fs.flatMap((_, i) => {
      const is: A[] = ass.map(as => as[i])
      return is.every(a => a !== undefined) ? [is] : []
    })
  )
}

// Recycle `a` (wrapping from the start) until it is exactly `length` long.
// [a, b] -> length 3 -> [a, b, a].
export function timesUntil<A>(length: number, a: A[]): A[] {
  if (a.length === 0) return []
  const repeated = Array(Math.ceil(length / a.length)).fill(a).flat() as A[]
  return repeated.slice(0, length)
}

// Zip lists, recycling the shorter ones up to the longest length (so nothing is
// dropped). [[a,b,c],[x,y]] -> [[a,x],[b,y],[c,x]]. This is the house zip rule
// (RandomizeLangUtils' zipLongest delegates here).
export function zipLongest<A>(...ass: A[][]): A[][] {
  const longest = Math.max(0, ...ass.map(a => a.length))
  return zipT(...ass.map(a => timesUntil(longest, a)))
}

// Full cartesian product across the lists, in row-major order (last list varies
// fastest). [[a,b],[x,y]] -> [[a,x],[a,y],[b,x],[b,y]]. Empty input -> [[]].
export function cartesian<A>(...ass: A[][]): A[][] {
  return ass.reduce<A[][]>((acc, list) => acc.flatMap(combo => list.map(x => [...combo, x])), [[]])
}

export function interleavingEvery<A>(into: A[], what: A[], every: number): A[] {
  const chunks = chunk(into, every)
  return zipT(chunks, times(chunks.length).map(_ => what)).flatMap(([as, bs]) => {
    return (as.length == every) ? as.concat(bs) : as
  })
}

export function arrayShift<A>(arr: A[], count: number): A[] {
  const len = arr.length
  const c = len - count
  arr.push(...arr.splice(0, (-c % len + len) % len))
  return arr
}

export function arrayMove<A>(arr1: A[], fromIndex: number, toIndex: number) {
  if (arr1.length < fromIndex) return arr1
  if (arr1.length < toIndex) return arr1

  const arr = [...arr1]
  const element = arr[fromIndex]
  arr.splice(fromIndex, 1)
  arr.splice(toIndex, 0, element)
  return arr
}

export function transpose<A>(matrix: A[][]): A[][] {
  return matrix[0].map((_, index) => matrix.map(row => row[index]))
}
