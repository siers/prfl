import * as ToneLib from './ToneLib'
import ReactDOMServer from 'react-dom/server'
import { pick } from './Random'

const stringSymbols = [
  <svg className="icon" width="48" height="48" viewBox="0 0 48 48" style={{ marginBottom: "-9px" }}>
    <rect x="0" y="30" width="48" height="3" fill="#fff" />
  </svg>,

  <svg className="icon" width="48" height="48" viewBox="0 0 48 48" style={{ marginBottom: "-9px" }}>
    <rect x="0" y="30" width="48" height="3" fill="#fff" />
    <rect x="0" y="20" width="48" height="3" fill="#fff" />
  </svg>,

  <svg className="icon" width="48" height="48" viewBox="0 0 48 48" style={{ marginBottom: "-9px" }}>
    <rect x="0" y="30" width="48" height="3" fill="#fff" />
    <rect x="0" y="20" width="48" height="3" fill="#fff" />
    <rect x="0" y="10" width="48" height="3" fill="#fff" />
  </svg>,

  <svg className="icon" width="48" height="48" viewBox="0 0 48 48" style={{ marginBottom: "-9px" }}>
    <rect x="0" y="30" width="48" height="3" fill="#fff" />
    <rect x="0" y="20" width="48" height="3" fill="#fff" />
    <rect x="0" y="10" width="48" height="3" fill="#fff" />
    <rect x="0" y="00" width="48" height="3" fill="#fff" />
  </svg>
]

export const strings = [
  { name: 'G', number: 0 },
  { name: 'D', number: 1 },
  { name: 'A', number: 2 },
  { name: 'E', number: 3 },
]

export const positions = [
  { name: '.5', count: 0, semi: 1 },
  { name: '1.', count: 1, semi: 2 },
  { name: '2a', count: 2, semi: 3 },
  { name: '2b', count: 3, semi: 4 },
  { name: '3a', count: 4, semi: 5 },
  { name: '3b', count: 5, semi: 6 },
  { name: '4.', count: 6, semi: 7 },
  { name: '5a', count: 8, semi: 8 },
  { name: '5b', count: 9, semi: 9 },
  { name: '6a', count: 10, semi: 10 },
  { name: '6b', count: 11, semi: 11 },
  { name: '7.', count: 12, semi: 12 },
]

export const positionSemitones = [0, 1, 2, 3, 4, 5, 6]
// export const positionSemitones = [-1, 0, 1, 2, 3, 4, 5, 6]

function calculate(string, pos, semi) {
  string = string === undefined ? pick(strings) : string
  pos = pos === undefined ? pick(positions) : pos
  semi = semi === undefined ? pick(pos.count > 0 ? positionSemitones : positionSemitones.slice(1)) : semi

  const semiBase = 35 + string.number * 7 + pos.semi
  const semiTarget = semiBase + semi

  return { string, pos, semiFinger: semi, semiBase, semiTarget }
}

// input: number, number, number, string, string
// output: [[keyNr, string]]
export function randomViolinNote(string, pos, semi) {
  function render(input) {
    const { string, pos, semiFinger, semiBase, semiTarget } = input

    const fingerMap = {
      '-1': ['.½'],
      '0': ['1.'],
      '1': ['1+', '2-'],
      '2': ['2+'],
      '3': ['3-'],
      '4': ['3+'],
      '5': ['4-'],
      '6': ['4+'],
    }

    const [_key, [baseNote, targetNote]] = ToneLib.findCommonKey(semiBase, semiTarget)
    return fingerMap[semiFinger].map(finger => {
      // const rightPad = (s, n) => ('' + s).padEnd(n, ' ').replaceAll(' ', '&nbsp;')
      const label = [
        ReactDOMServer.renderToStaticMarkup(stringSymbols[3 - string.number]),
        `${baseNote.render}<sub>${pos.name}</sub>`,
        `${targetNote.render}<sub>${finger}</sub>`
      ].join('')

      return [semiTarget, label]
    })
  }

  function main(string, pos, semi) {
    return render(calculate(string, pos, semi))
  }

  return main(
    string !== undefined ? strings[string] : undefined,
    pos !== undefined ? positions[pos] : undefined,
    semi,
  )
}

export function randomViolinNotePlain(string, pos, semi) {
  function render(input) {
    const { string, pos, semiFinger, semiBase, semiTarget } = input

    const fingerMap = {
      '-1': ['.½'],
      '0': ['1.'],
      '1': ['1+', '2-'],
      '2': ['2+'],
      '3': ['3-'],
      '4': ['3+'],
      '5': ['4-'],
      '6': ['4+'],
    }

    const strings = ['G3', 'D4', 'A4', 'E5']
    var [key, [baseNote, targetNote]] = ToneLib.findCommonKey(semiBase, semiTarget)
    baseNote = ToneLib.rebaseSemi(baseNote, semiBase)
    targetNote = ToneLib.rebaseSemi(targetNote, semiTarget)

    return fingerMap[semiFinger].map(finger => {
      return {
        semi: semiTarget,
        string: strings[string.number],
        base: baseNote,
        target: targetNote,
        finger: finger,
        position: pos.name,
      }
    })
  }

  function main(string, pos, semi) {
    return render(calculate(string, pos, semi))
  }

  return main(
    string !== undefined ? strings[string] : undefined,
    pos !== undefined ? positions[pos] : undefined,
    semi,
  )
}
