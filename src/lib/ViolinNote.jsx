import ToneLib from './ToneLib'
import ReactDOMServer from 'react-dom/server'

const logWindow = document.querySelector('.log')

function log(print) {
  if (print === undefined) print = '-- -- --'
  const e = document.createElement('p')
  e.innerText = print
  logWindow.prepend(e)
  console.log(print)
}

function logKey(key) {
  key.map(n => log(JSON.stringify(n) + ' ' + n.render))
}

// arrayShift([1, 2, 3], 1) == [2, 3, 1]
function arrayShift(arr, count) {
  const len = arr.length
  const c = len - count
  arr.push(...arr.splice(0, (-c % len + len) % len))
  return arr
}

function randInt(from, to) {
  return from + Math.floor(Math.random() * (to - from + 1))
}

function pick(array) {
  return array[randInt(0, array.length - 1)]
}

const stringSymbols = [
  <svg className="icon" width="48" height="48" viewBox="0 0 48 48" style={{ marginBottom: "-9px" }}>
    <rect x="0" y="30" width="48" height="3" fill="#fff"/>
  </svg>,

  <svg className="icon" width="48" height="48" viewBox="0 0 48 48" style={{ marginBottom: "-9px" }}>
    <rect x="0" y="30" width="48" height="3" fill="#fff"/>
    <rect x="0" y="20" width="48" height="3" fill="#fff"/>
  </svg>,

  <svg className="icon" width="48" height="48" viewBox="0 0 48 48" style={{ marginBottom: "-9px" }}>
    <rect x="0" y="30" width="48" height="3" fill="#fff"/>
    <rect x="0" y="20" width="48" height="3" fill="#fff" />
    <rect x="0" y="10" width="48" height="3" fill="#fff"/>
  </svg>,

  <svg className="icon" width="48" height="48" viewBox="0 0 48 48" style={{ marginBottom: "-9px" }}>
    <rect x="0" y="30" width="48" height="3" fill="#fff"/>
    <rect x="0" y="20" width="48" height="3" fill="#fff"/>
    <rect x="0" y="10" width="48" height="3" fill="#fff"/>
    <rect x="0" y="00" width="48" height="3" fill="#fff"/>
  </svg>
]

// input: number, number, number, string, string
// output: [[keyNr, string]]
export function randomViolinNote(string, pos, semi, slide, bowing) {
  var [s_, f_, n_] = ['♯', '♭', '♮']

  var strings = [
    {name: 'G', number: 0},
    {name: 'D', number: 1},
    {name: 'A', number: 2},
    {name: 'E', number: 3},
  ]

  var positions = [
    {name: '.5', count: 0, semi: 1},
    {name: '1.', count: 1, semi: 2},
    {name: '2a', count: 2, semi: 3},
    {name: '2b', count: 3, semi: 4},
    {name: '3a', count: 4, semi: 5},
    {name: '3b', count: 5, semi: 6},
    {name: '4.', count: 6, semi: 7},
    {name: '5a', count: 8, semi: 8},
    {name: '5b', count: 9, semi: 9},
    {name: '6a', count: 10, semi: 10},
    {name: '6b', count: 11, semi: 11},
    {name: '7.', count: 11, semi: 12},
  ]

  var positionSemitones = [-1, 0, 1, 2, 3, 4, 5, 6]

  function calculate(string, pos, semi, slide, bowing) {
    string = string === undefined ? pick(strings) : string
    pos    = pos === undefined ? pick(positions) : pos
    semi   = semi === undefined ? pick(pos.count > 0 ? positionSemitones : positionSemitones.slice(1)) : semi

    var semiBase = 47 + string.number * 7 + pos.semi
    var semiTarget = semiBase + semi

    var slide  = slide === undefined ? pick('-↑↓'.split('')) : slide
    var bowing = bowing === undefined ? pick('VΠ'.split('')) : bowing

    return {string, pos, semiFinger: semi, semiBase, semiTarget, slide, bowing}
  }

  function render(input) {
    var {string, pos, semiFinger, semiBase, semiTarget, slide, bowing} = input

    var fingerMap = {
      '-1': ['.½'],
      '0': ['1.'],
      '1': ['1+', '2-'],
      '2': ['2+'],
      '3': ['3-'],
      '4': ['3+'],
      '5': ['4-'],
      '6': ['4+'],
    }

    const [key, [baseNote, targetNote]] = (new ToneLib).findCommonKey(semiBase, semiTarget)
    return fingerMap[semiFinger].map(finger => {
      var rightPad = (s, n) => ('' + s).padEnd(n, ' ').replaceAll(' ', '&nbsp;')
      var label = [
        ReactDOMServer.renderToStaticMarkup(stringSymbols[3 - string.number]),
        `${baseNote.render}<sub>${pos.name}</sub>`,
        `${targetNote.render}<sub>${finger}</sub>`
        ].join('')
          + ` ${slide}/${bowing}`

      return [semiTarget, label]
    })
  }

  function main(string, pos, semi, slide, bowing) {
    return render(calculate(string, pos, semi, slide, bowing))
  }

  return main(
    string !== undefined ? strings[string] : undefined,
    pos !== undefined ? positions[pos] : undefined,
    semi,
    slide,
    bowing,
  )
}
