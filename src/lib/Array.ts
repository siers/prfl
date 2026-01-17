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
