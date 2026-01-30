export function chunk<A>(arr: A[], len: number) {
  var chunks = [], i = 0, n = arr.length;
  while (i < n) chunks.push(arr.slice(i, i += len))
  return chunks
}

// forwards only
export function directRange(start: number, stop: number) {
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

export function interleavingEvery<A>(into: A[], what: A[], every: number): A[] {
  const chunks = chunk(into, every)
  return zipT(chunks, times(chunks.length).map(_ => what)).flatMap(([as, bs]) => {
    return (as.length == every) ? as.concat(bs) : as
  })
}
