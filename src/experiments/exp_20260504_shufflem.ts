import { chunk, clamp, shuffle, zip } from "lodash"
import { directRangeClamp, zipWithIndex } from "../lib/Array"

function surroundingIndices<A>(array: A[], index: number, distance: number) {
  return [
    directRangeClamp(0, array.length - 1, index - distance, index - 1),
    directRangeClamp(0, array.length - 1, index + 1, index + distance),
  ].flat()
}

export function checkIsShuffledMinD(min: number, shuffled: number[]): boolean {
  var isValid = true
  for (let i = 0; i < shuffled.length; i++) {
    const indices = surroundingIndices(shuffled, i, min)
    for (let jj = 0; jj < indices.length; jj++) {
      const j = indices[jj]
      isValid = isValid && Math.abs(shuffled[i] - shuffled[j]) > min

      if (!isValid) break
    }

    if (!isValid) break
  }

  return isValid
}

export function shuffleMI<A>(min: number, a: A[]): [number, A][] {
  const div = chunk(zipWithIndex(a), clamp(Math.ceil(a.length / (min + 2)), 1, a.length))
  console.log('div', div)
  return zip(...div.map(a => shuffle(a))).flat().filter(a => a != undefined)
}

export function shuffleM<A>(min: number, a: A[]): A[] {
  return shuffleMI(min, a).map(a => a[1])
}
