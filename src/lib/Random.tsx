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

// non-deterministic on purpose to make the constraints easier to verify
// features missing: the distances in first/last element aren't considered
// fails at min = 6
export function shuffleMinDistance(array, min) {
  const maxAttempts = 100000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = shuffleArray(zipWithIndex(array))

    var isValid = true
    for (let i = 0; i < array.length - 1; i++) {
      if (Math.abs(shuffled[i][0] - shuffled[i + 1][0]) < min) {
        isValid = false
        break
      }
    }

    if (isValid) {
      return shuffled.map(([_i, x]) => x)
    }
  }

  return array.map(_ => 'x') // make failure clearly visible
}
