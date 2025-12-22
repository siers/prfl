import { directRangeClamp } from './Array'

function randInt(from, to) {
  return from + Math.floor(Math.random() * (to - from + 1))
}

export function pick(array) {
  return array[randInt(0, array.length - 1)]
}

export function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1))
    var temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
  return array
}

function zipWithIndex(as) {
  return as.map((x, i) => [i, x])
}

function surroundingIndices(array, index, distance) {
  return [
    directRangeClamp(0, array.length - 1, index - distance, index - 1),
    directRangeClamp(0, array.length - 1, index + 1, index + distance),
  ].flat()
}

// for 100 items, it can't find a solution with min = 3...
// pretty weak, perhaps the problem is too hard as such
export function shuffleMinDistance(array, min) {
  const maxAttempts = 100000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = shuffleArray(zipWithIndex(array))

    var isValid = true
    for (let i = 0; i < shuffled.length - 1; i++) {
      const indices = surroundingIndices(shuffled, i, min)
      for (let jj = 0; jj < indices.length - 1; jj++) {
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

  return array.map(_ => 'x') // make failure clearly visible
}
