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

// vibe-implemented, but is valid.
// design constraints: nondeterministic calculation.
// features missing: the distances in first/last element aren't considered
// fails at min = 6
export function shuffleMinDistance(array, min) {
  const maxAttempts = 100000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = shuffleArray([...array])

    let isValid = true
    for (let i = 0; i < array.length; i++) {
      const originalIndex = array.indexOf(shuffled[i])
      if (Math.abs(originalIndex - i) < min) {
        isValid = false
        break
      }
    }

    if (isValid) {
      return shuffled
    }
  }

  return array.map(_ => 'x') // to make it clear that it gave up
}
