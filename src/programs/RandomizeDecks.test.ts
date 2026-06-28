import { describe, expect, test } from 'vitest'
import { evalContents } from './RandomizeLang.js'
import { UserItem, toUserItem } from './RandomizeTypes.js'
import { itemParams, isSpawnable, spawnChildren, spawnDeckName } from './RandomizeDecks.ts'

// Build a faithful parent item through the real evaluator, so substitutions
// carry the shapes the app actually produces.
function evalItem(text: string): UserItem {
  return toUserItem(evalContents(text)[0])
}

const SCALE = "Scale: play [s('C,D')]key [s('up,down')]bow"
const labels = (items: UserItem[]) => items.map(i => i.contents)
const keys = (items: UserItem[]) => items.map(i => i.key)

describe('itemParams / isSpawnable', () => {
  test('reads each substitution as a parameter, in order', () => {
    const params = itemParams(evalItem(SCALE))
    expect(params.map(p => p.tag)).toStrictEqual(['key', 'bow'])
    expect(params.map(p => p.values)).toStrictEqual([['C', 'D'], ['up', 'down']])
  })

  test('a plain line with no interpolations is not spawnable', () => {
    expect(isSpawnable(evalItem('Just: do it'))).toBe(false)
    expect(itemParams(evalItem('Just: do it'))).toStrictEqual([])
  })

  test('a single-value param is not worth spawning', () => {
    expect(isSpawnable(evalItem("One: play [s('C')]key"))).toBe(false)
  })

  test('a multi-value param is spawnable', () => {
    expect(isSpawnable(evalItem(SCALE))).toBe(true)
  })
})

describe('spawnChildren — zip', () => {
  test('aligns parameters position-by-position', () => {
    const children = spawnChildren(evalItem(SCALE), 'zip')
    expect(labels(children)).toStrictEqual(['Scale: play [C] [up]', 'Scale: play [D] [down]'])
  })

  test('recycles the shorter parameter up to the longest (house zipLongest rule)', () => {
    const children = spawnChildren(evalItem("Scale: play [s('C,D,E')]key [s('up,down')]bow"), 'zip')
    // bow recycles: up, down, up
    expect(labels(children)).toStrictEqual([
      'Scale: play [C] [up]',
      'Scale: play [D] [down]',
      'Scale: play [E] [up]',
    ])
  })
})

describe('spawnChildren — cartesian', () => {
  test('produces every combination, last parameter varying fastest', () => {
    const children = spawnChildren(evalItem(SCALE), 'cartesian')
    expect(labels(children)).toStrictEqual([
      'Scale: play [C] [up]',
      'Scale: play [C] [down]',
      'Scale: play [D] [up]',
      'Scale: play [D] [down]',
    ])
  })
})

describe('child keys & deck name', () => {
  test('child key is parentKey-[v1]-[v2] per combination', () => {
    const children = spawnChildren(evalItem(SCALE), 'cartesian')
    expect(keys(children)).toStrictEqual([
      'Scale-[C]-[up]', 'Scale-[C]-[down]', 'Scale-[D]-[up]', 'Scale-[D]-[down]',
    ])
  })

  test('deck name combines the parent key and the mode', () => {
    const item = evalItem(SCALE)
    expect(spawnDeckName(item, 'zip')).toBe('Scale/zip')
    expect(spawnDeckName(item, 'cartesian')).toBe('Scale/cartesian')
  })

  test('children keep a collapsed source: each substitution narrowed to its one value', () => {
    const children = spawnChildren(evalItem(SCALE), 'zip')
    expect(children.every(c => c.source !== null)).toBe(true)
    // values narrowed to the chosen one, markers and tags preserved
    expect(children[0].source?.substitutions?.map(s => s.contents)).toStrictEqual([['C'], ['up']])
    expect(children[0].source?.substitutions?.map(s => s.tag)).toStrictEqual(['key', 'bow'])
  })

  test('children are single-valued, so not spawnable again', () => {
    const children = spawnChildren(evalItem(SCALE), 'zip')
    expect(children.every(c => !isSpawnable(c))).toBe(true)
  })
})
