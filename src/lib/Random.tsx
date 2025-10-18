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
