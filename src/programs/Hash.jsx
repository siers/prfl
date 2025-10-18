function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)]
}

function getHash() {
  return location.hash.substr(1)
}

function getThings() {
  return (getHash() != '') ? getHash().split(':').at(-1).split('-') : [0, 1, 2, 3]
}

function Hash() {
  return randomItem(getThings())
}

export default Hash