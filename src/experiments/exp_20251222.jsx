// force-directed search for linear ordering with minimum distance
// sh:
//  npm install d3-force
// main.jsx:
//   import './experiments/exp_20251222'

import * as d3 from 'd3-force'

import { shuffleArray } from '../lib/Random'

// forwards only
const directRange = (start, stop) => {
  if (start > stop)
    return []
  else
    return Array(stop - start + 1).fill(start).map((x, y) => x + y)
}

const directRangeClamp = (min, max, start, stop) => {
  return directRange(Math.max(min, start), Math.min(max, stop))
}

function sortLines(linesList, minDistance) {
  const lines = linesList.map((_, idx) => idx)
  const nodes = shuffleArray(lines).map(l => ({id: l, group: 1}))

  const links = nodes.flatMap((node, _index) => {
    const index = node.id // since they're reshuffled, the index is meaningless

    return [
      directRangeClamp(0, nodes.length - 1, index - minDistance, index - 1),
      directRangeClamp(0, nodes.length - 1, index + 1, index + minDistance),
    ].flat().map(targetIdx => ({source: index, target: targetIdx, strength: 2000}))
  })

  // console.log(nodes)
  // console.log('links: ', links)

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(d => 50 + d.strength * 200)) // .strength(d => d.strength)
    .force('charge', d3.forceManyBody().strength(-300))
    .force('x', d3.forceX(400))
    .force('collision', d3.forceCollide().radius(30))

  for (let i = 0; i < 1000; i++) {
    nodes.forEach(node => { node.y = 300 }) // force 1-d
    simulation.tick()
  }

  // nodes.forEach(node => {
  //   console.log(`${node.id}: x=${node.x.toFixed(2)}, y=${node.y.toFixed(2)}`)
  // })

  // links.forEach(link => {
  //   console.log(`${link.source.id} → ${link.target.id}:`, {
  //     source: { x: link.source.x.toFixed(2), y: link.source.y.toFixed(2) },
  //     target: { x: link.target.x.toFixed(2), y: link.target.y.toFixed(2) }
  //   })
  // })

  const order = nodes.sort(({x: x1}, {x: x2}) => x1 - x2).map(n => n.id)

  return order.map(i => linesList[i])
}

function compAvg(diff) {
  return directRange(1, 25).map(_ => {
    const out = sortLines('abcdefghijk'.split(''), diff)
    return Math.abs(out.indexOf('b') - out.indexOf('a'))
  })
}

directRange(0, 5).forEach(diff => {
  const avg = compAvg(diff)
  console.log(`${diff}: `, avg.reduce((a, b) => a + b) / avg.length)
})

// this makes no sense, something is wrong here, it's probably chaotic
// 0:  3.64
// 1:  6.4
// 2:  5.92
// 3:  5.88
// 4:  4.84
// 5:  3.36
