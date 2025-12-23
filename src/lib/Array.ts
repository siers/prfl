export function chunk(arr, len) {
  var chunks = [], i = 0, n = arr.length;
  while (i < n) chunks.push(arr.slice(i, i += len))
  return chunks
}

// forwards only
export function directRange(start, stop) {
  if (start > stop)
    return []
  else
    return Array(stop - start + 1).fill(start).map((x, y) => x + y)
}

export function directRangeClamp(min, max, start, stop) {
  return directRange(Math.max(min, start), Math.min(max, stop))
}

export function times(n) {
  return directRange(1, n)
}

export function zipWithIndex(as) {
  return as.map((x, i) => [i, x])
}

export function indices(as) {
  return as.map((_, i) => i)
}

export function reorderIndices(lines, indices) {
  return indices.map(i => lines[i])
}
