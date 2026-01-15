import { shuffleArray, shuffleMinDistanceIndexed } from '../lib/Random'
import { times } from '../lib/Array'

const marker = 'XZYZX'

// out: [line, [groups]]
export function replaceMatchesMarker(line, regex, marker) {
  const groups = []

  const template = line.replaceAll(regex, match => {
    groups.push(match)
    return marker
  })

  return [template, groups]
}

export function generateCombinations(line) {
  const [template, matches] = replaceMatchesMarker(line, /\{[^\}]+\}/g, marker)

  const groups = matches.map(choicesParen => choicesParen.match(/^\{(.*)\}$/)[1].split(','))

  return groups.reduce((replaced, group) => {
    return group.flatMap(choice => {
      return replaced.map(templateLine => {
        return templateLine.replace(/\{[^\}]+\}/, choice)
      })
    })
  }, [line])
}

export function localCombinations(line) {
  return line.replaceAll(/\[[^\[\]]+\]/g, match => {
    const contents = match.match(/^\[(.*)\]$/)[1].split(' ')
    const combined = contents.flatMap(s => generateCombinations(s))

    return `[${shuffleArray(combined).join(' ')}]`
  })
}

export function parseContents(text) {
  return text.split(/\n---\n/).map(text => {
    const lines = text.split('\n').filter(x => !x.match(/^ *$/))
    return multiplyLines(lines.flatMap(generateCombinations)).map(([i, l]) => [i, localCombinations(l)])
  })
}

export function parseAndShuffle(text, distance) {
  const indexedLineBlocks = parseContents(text)
  return indexedLineBlocks.map(ls => shuffleMinDistanceIndexed(ls, distance).join('\n')).join('\n---\n')
}

// multiplies lines if they have "3x" in front of them
// bug: breaks the shuffler, perhaps something's ill defined
function multiplyLines(lines) {
  return lines.flatMap((line, index) => {
    const match = line.match(/^(\d+)x (.*)$/)

    if (match) {
      const [_, n, title] = match
      return times(parseInt(n)).map(_ => [index, title])
    } else
      return [[index, line]]
  })
}
