import { describe, expect, test } from 'vitest'
import { initSequences, evalContentsS, evalContents, evalContentsMem, evalContentsDecks, rotateInterpolableLine, evalRenderLine, renderLineContentWithTags, extractTagFunctions } from './RandomizeLang.js'
import { isFrozen, isComputed, isHidden, showCount } from './RandomizeLangTypes.js'

test('initSequences', () => {
  expect(initSequences('abbaccadddd'.split(''), s => !!s.match('a'))).toStrictEqual(
    "abb|acc|adddd".split('|').map(c => c.split(''))
  )

  expect(initSequences('bbaccadddd'.split(''), s => !!s.match('a'))).toStrictEqual(
    "bb|acc|adddd".split('|').map(c => c.split(''))
  )

  expect(initSequences('baccadddd'.split(''), s => !!s.match('a'))).toStrictEqual(
    "b|acc|adddd".split('|').map(c => c.split(''))
  )
})

describe('evalContents', () => {
  test('basic', () => {
    expect(evalContentsS('')).toStrictEqual([])
    expect(evalContentsS('a')).toStrictEqual(['a'])
  })

  test('comments', () => {
    const text = `
      -=-
      a
      #b
      # b
      c
    `.replaceAll(/^ */mg, '')

    expect(evalContentsS(text)).toStrictEqual([
      'a',
      'c',
    ])
  })

  test('blocks without initial header', () => {
    const text = `
      a
      -=-
      b
      c
    `.replaceAll(/^ */mg, '')

    expect(evalContentsS(text)).toStrictEqual([
      'a',
      '---',
      'b',
      'c',
    ])
  })

  test('blocks', () => {
    const text = `
      -=-
      a
      b
      -=-
      c
      d
    `.replaceAll(/^ */mg, '')

    expect(evalContentsS(text)).toStrictEqual([
      'a',
      'b',
      '---',
      'c',
      'd',
    ])
  })

  test('block context interpolate', () => {
    const text = `
      -=- a
      a
      b
      -=-
      [block('a')]
    `.replaceAll(/^ */mg, '')

    expect(evalContentsS(text)).toStrictEqual(['[a b]'])
  })

  test('block context explode', () => {
    const text = `
      -=- a
      a
      b
      -=-
      {block('a')}
      -
      {block('a')}
    `.replaceAll(/^ */mg, '')

    expect(evalContentsS(text)).toStrictEqual(['a', 'b', '-', 'a', 'b'])
  })

  test('copies', () => {
    const text = `
      -=-
      a
      2x b
    `.replaceAll(/^ */mg, '')

    expect(evalContentsS(text)).toStrictEqual([
      'a',
      'b',
      'b',
    ])
  })

  test('eval interpolate', () => {
    expect(evalContentsS('item [1]')).toStrictEqual(['item [1]'])
    expect(evalContentsS('item ["a"]')).toStrictEqual(['item [a]'])
    expect(evalContentsS('item [s("a b")]')).toStrictEqual(['item [a b]'])
  })

  test('eval interpolate 2d', () => {
    expect(evalContentsS('item [divide(s("abcd"), 2)]')).toStrictEqual(['item [ab cd]'])
  })

  test('eval explode', () => {
    expect(evalContentsS('-=-\nitem {s("abc")}')).toStrictEqual(['item a', 'item b', 'item c'])
    expect(evalContentsS('-=-\nitem {divide(s("ab"), 2)}')).toStrictEqual(['item [a]', 'item [b]'])
    expect(evalContentsS('-=-\nitem {divide(s("abcd"), 2)}')).toStrictEqual(['item [a b]', 'item [c d]'])
  })

  test('escaped brackets', () => {
    expect(evalContentsS('item ["a\\]b"]')).toStrictEqual(['item [a]b]'])
    expect(evalContentsS('-=-\nitem {s("a\\}b c")}')).toStrictEqual(['item a}b', 'item c'])
  })
})

describe('scheduleBlocks', () => {
  test('no suffix picks 1', () => {
    const text = `
      -=- tasks
      t1: task one
      t2: task two
      t3: task three
      -=-
      {scheduleBlocks('tasks')}
    `.replaceAll(/^ */mg, '')

    expect(evalContentsS(text)).toHaveLength(3)
  })

  test('dash suffix picks n', () => {
    const text = `
      -=- tasks
      t1: task one
      t2: task two
      t3: task three
      -=-
      {scheduleBlocks('tasks-2')}
    `.replaceAll(/^ */mg, '')

    expect(evalContentsS(text)).toHaveLength(2)
  })

  test('dash suffix 0 picks 0', () => {
    const text = `
      -=- tasks
      t1: task one
      t2: task two
      -=-
      {scheduleBlocks('tasks-0')}
    `.replaceAll(/^ */mg, '')

    expect(evalContentsS(text)).toStrictEqual([])
  })

  test('digits without dash are part of name', () => {
    const text = `
      -=- tasks2
      t1: task one
      -=-
      {scheduleBlocks('tasks2')}
    `.replaceAll(/^ */mg, '')

    expect(evalContentsS(text)).toHaveLength(1)
  })
})

describe('integration', () => {
  test('aba split', () => {
    const text = `
      -=- a
      1
      2
      -=- b
      3
      4
      -=-
      {[a1,a2]=divide(block('a'), 2); return [...a1, ...block('b'), ...a2];}
    `.replaceAll(/^ */mg, '')

    expect(evalContentsS(text)).toStrictEqual(['1', '3', '4', '2'])
  })
})

describe('subdeck blocks', () => {
  const decksS = text => {
    const [_lines, subdecks] = evalContentsDecks(text)
    return Object.fromEntries(Object.entries(subdecks).map(([k, v]) => [k, v.map(rl => rl.contents)]))
  }

  test('items go to the named subdeck, and nothing is added to the root deck', () => {
    const text = `
      a
      -=- sub::
      b
      c
    `.replaceAll(/^ */mg, '')

    expect(evalContentsS(text)).toStrictEqual(['a'])
    expect(decksS(text)).toStrictEqual({ 'sub/': ['b', 'c'] })
  })

  test('a subdeck-only text leaves the root deck empty', () => {
    const [lines] = evalContentsDecks("-=- sub::\nb")
    expect(lines).toStrictEqual([])
  })

  test('several subdecks coexist, and the root keeps only its own blocks', () => {
    const text = `
      a
      -=- one::
      b
      -=- two::
      c
      -=-
      d
    `.replaceAll(/^ */mg, '')

    expect(evalContentsS(text)).toStrictEqual(['a', '---', 'd'])
    expect(decksS(text)).toStrictEqual({ 'one/': ['b'], 'two/': ['c'] })
  })

  test('blocks sharing a name concatenate into one deck', () => {
    const text = `
      -=- sub::
      b
      -=- sub::
      c
    `.replaceAll(/^ */mg, '')

    expect(evalContentsS(text)).toStrictEqual([])
    expect(decksS(text)).toStrictEqual({ 'sub/': ['b', 'c'] })
  })

  test('a subdeck block is not callable, unlike a plain named block', () => {
    const text = `
      -=- sub::
      b
      -=-
      [block('sub')]
    `.replaceAll(/^ */mg, '')

    expect(decksS(text)).toStrictEqual({ 'sub/': ['b'] })
    expect(evalContentsS(text)).toStrictEqual(["[error: block('sub') == undefined]"])
  })

  test('an item keyed like the deck reaches it — but the author writes that item', () => {
    const text = `
      scales: warm up first
      -=- scales::
      MAJ
    `.replaceAll(/^ */mg, '')

    const [lines] = evalContentsDecks(text)
    expect(lines.map(l => [l.contents, l.key])).toStrictEqual([['scales: warm up first', 'scales']])
    expect(decksS(text)).toStrictEqual({ 'scales/': ['MAJ'] })
  })

  test('subdeck items are ordinary items: interpolations, keys and tags survive', () => {
    const [_lines, subdecks] = evalContentsDecks("-=- sub::\nKEY: [s('x y')]t\n")
    const [item] = subdecks['sub/']

    expect(item.contents).toStrictEqual('KEY: [x y]')
    expect(item.key).toStrictEqual('KEY')
    expect(item.source.substitutions).toStrictEqual([
      { kind: 'substitution', contents: ['x', 'y'], marker: '!!!1', tag: 't', tags: null },
    ])
  })

  test('`---` subdecks shuffle their items, `-=-` keep order', () => {
    const ordered = decksS("-=- sub::\n" + 'abcdefgh'.split('').join('\n'))
    expect(ordered['sub/']).toStrictEqual('abcdefgh'.split(''))

    const shuffled = decksS("--- sub::\n" + 'abcdefgh'.split('').join('\n'))
    expect(shuffled['sub/'].slice().sort()).toStrictEqual('abcdefgh'.split(''))
  })

  test('an anonymous `::` header is just a main block', () => {
    expect(evalContentsS("-=- ::\na")).toStrictEqual(['a'])
    expect(decksS("-=- ::\na")).toStrictEqual({})
  })

  test('`::` inside a line is not a header', () => {
    expect(evalContentsS('a:: b')).toStrictEqual(['a:: b'])
    expect(decksS('a:: b')).toStrictEqual({})
  })
})

describe('memory', () => {
  test('basic', () => {
    const text = `
      {memory.set('a', (memory.get('a') || 0) + 1);}
    `.replaceAll(/^ */mg, '')

    const [out, mem1] = evalContentsMem(text)
    const [_, mem2] = evalContentsMem(text, mem1)

    expect(out).toStrictEqual([])
    expect(mem1).toStrictEqual(new Map([["a", 1]]))
    expect(mem2).toStrictEqual(new Map([["a", 2]]))
  })
})

describe('evaling items inside a block', () => {
  test('evalItem', () => {
    const text = `
      -=- a
      a
      b
      c
      -=-
      {blockLines('a')}
    `.replaceAll(/^ */mg, '')

    expect(evalContentsS(text)).toStrictEqual(['a', 'b', 'c'])
  })

  test('blockLines preserve source', () => {
    const text = `
      -=- a
      a: [s('12')] [s('34')]tagX
      -=-
      {blockLines('a')}
    `.replaceAll(/^ */mg, '')

    expect(evalContents(text)).toStrictEqual([
      {
        "contents": "a: [1 2] [3 4]",
        "key": "a",
        "kind": "renderline",
        "separator": null,
        "source": {
          "contents": "a: !!!1 !!!2",
          "interpols": [
            {
              "command": "s('12')",
              "kind": "interpolate",
              "marker": "!!!1",
              "tag": "tag1",
              "tags": null,
            },
            {
              "command": "s('34')",
              "kind": "interpolate",
              "marker": "!!!2",
              "tag": "tagX",
              "tags": null,
            },
          ],
          "kind": "interpolable-line",
          "substitutions": [
            {
              "contents": [
                "1",
                "2",
              ],
              "kind": "substitution",
              "marker": "!!!1",
              "tag": "tag1",
              "tags": null,
            },
            {
              "contents": [
                "3",
                "4",
              ],
              "kind": "substitution",
              "marker": "!!!2",
              "tag": "tagX",
              "tags": null,
            },
          ],
        },
      },
    ])
  })
})

describe('rotateInterpolableLine', () => {
  test('evalItem', () => {
    const text = `
      Thing: do it [s('12')]tagS [s('12')]tagK
    `.replaceAll(/^ */mg, '')

    const item = evalContents(text)[0]

    expect(item).toStrictEqual({
      "contents": "Thing: do it [1 2] [1 2]",
      "key": "Thing",
      "kind": "renderline",
      "separator": null,
      "source": {
        "contents": "Thing: do it !!!1 !!!2",
        "interpols": [
          {
            "command": "s('12')",
            "kind": "interpolate",
            "marker": "!!!1",
            "tag": "tagS",
            "tags": null,
          },
          {
            "command": "s('12')",
            "kind": "interpolate",
            "marker": "!!!2",
            "tag": "tagK",
            "tags": null,
          },
        ],
        "kind": "interpolable-line",
        "substitutions": [
          {
            "contents": [
              "1",
              "2",
            ],
            "kind": "substitution",
            "marker": "!!!1",
            "tag": "tagS",
            "tags": null,
          },
          {
            "contents": [
              "1",
              "2",
            ],
            "kind": "substitution",
            "marker": "!!!2",
            "tag": "tagK",
            "tags": null,
          },
        ],
      },
    })

    expect(rotateInterpolableLine(item)).toStrictEqual({
      "contents": "Thing: do it [2 1] [2 1]",
      "key": "Thing",
      "kind": "renderline",
      "separator": null,
      "source": {
        "contents": "Thing: do it !!!1 !!!2",
        "interpols": [
          {
            "command": "s('12')",
            "kind": "interpolate",
            "marker": "!!!1",
            "tag": "tagS",
            "tags": null,
          },
          {
            "command": "s('12')",
            "kind": "interpolate",
            "marker": "!!!2",
            "tag": "tagK",
            "tags": null,
          },
        ],
        "kind": "interpolable-line",
        "substitutions": [
          {
            "contents": [
              "2",
              "1",
            ],
            "kind": "substitution",
            "marker": "!!!1",
            "tag": "tagS",
            "tags": null,
          },
          {
            "contents": [
              "2",
              "1",
            ],
            "kind": "substitution",
            "marker": "!!!2",
            "tag": "tagK",
            "tags": null,
          },
        ],
      },
    })

    expect(rotateInterpolableLine(item, 'tagK')).toStrictEqual({
      "contents": "Thing: do it [1 2] [2 1]",
      "key": "Thing",
      "kind": "renderline",
      "separator": null,
      "source": {
        "contents": "Thing: do it !!!1 !!!2",
        "interpols": [
          {
            "command": "s('12')",
            "kind": "interpolate",
            "marker": "!!!1",
            "tag": "tagS",
            "tags": null,
          },
          {
            "command": "s('12')",
            "kind": "interpolate",
            "marker": "!!!2",
            "tag": "tagK",
            "tags": null,
          },
        ],
        "kind": "interpolable-line",
        "substitutions": [
          {
            "contents": [
              "1",
              "2",
            ],
            "kind": "substitution",
            "marker": "!!!1",
            "tag": "tagS",
            "tags": null,
          },
          {
            "contents": [
              "2",
              "1",
            ],
            "kind": "substitution",
            "marker": "!!!2",
            "tag": "tagK",
            "tags": null,
          },
        ],
      },
    })
  })
})

describe('keys', () => {
  test('check IR for key parsing', () => {
    const text = `DoTheLaundry: do it`

    expect(evalContents(text)).toStrictEqual([
      {
        "contents": "DoTheLaundry: do it",
        "key": "DoTheLaundry",
        "kind": "renderline",
        "separator": null,
        "source": null,
      }
    ])
  })

  test('parse keys without a colon', () => {
    const text = `DoTheLaundry`

    expect(evalContents(text)).toStrictEqual([
      {
        "contents": "DoTheLaundry",
        "key": "DoTheLaundry",
        "kind": "renderline",
        "separator": null,
        "source": null,
      }
    ])
  })
})

describe('extractTagFunctions', () => {
  test('extracts a function and its args', () => {
    expect(extractTagFunctions(['function-arg1-arg2']))
      .toStrictEqual(new Map([['function', ['arg1', 'arg2']]]))
  })

  test('no tags => empty map', () => {
    expect(extractTagFunctions(null)).toStrictEqual(new Map())
    expect(extractTagFunctions([])).toStrictEqual(new Map())
  })

  test('a bare tag has no args', () => {
    expect(extractTagFunctions(['show'])).toStrictEqual(new Map([['show', []]]))
  })

  test('each tag becomes its own entry, last one wins per function', () => {
    expect(extractTagFunctions(['show-5', 'crop-2-4']))
      .toStrictEqual(new Map([['show', ['5']], ['crop', ['2', '4']]]))
    expect(extractTagFunctions(['show-1', 'show-9']))
      .toStrictEqual(new Map([['show', ['9']]]))
  })

  test('reads the tags a real interpolation parses out', () => {
    const item = evalContents("Thing: do it [s('12')]tag:show-5:crop-2-4")[0]

    expect(extractTagFunctions(item.source.substitutions[0].tags))
      .toStrictEqual(new Map([['show', ['5']], ['crop', ['2', '4']]]))
  })
})

describe('renderLineContentWithTags', () => {
  test('renderLineContentWithTags 0', () => {
    const text = `
      x
    `.replaceAll(/^ */mg, '')

    const item = evalContents(text)[0]

    expect(renderLineContentWithTags(item)).toStrictEqual([[['string', 'x']], new Map()])
  })

  test('renderLineContentWithTags', () => {
    const text = `
      Thing: do it [s('123456')]tag:show-5
    `.replaceAll(/^ */mg, '')

    const item = evalContents(text)[0]

    expect(renderLineContentWithTags(item)).toStrictEqual(
      [
        [
          [
            "string",
            "Thing: do it ",
          ],
          [
            "tag",
            "tag",
          ],
        ],
        new Map([[
          "tag", {
            "contents": [
              "1",
              "2",
              "3",
              "4",
              "5",
            ],
            "kind": "substitution",
            "marker": "!!!1",
            "tag": "tag",
            "tags": ["show-5"],
          }],
        ]),
      ]
    )
  })
})

describe('freeze', () => {
  test('a `freeze` tag marks the interpolate and its substitution as frozen', () => {
    const item = evalContents("Thing: do it [s('12')]tag:freeze")[0]

    expect(isFrozen(item.source.interpols[0])).toBe(true)
    expect(isFrozen(item.source.substitutions[0])).toBe(true)
  })

  test('without `freeze`, the interpolate and substitution are not frozen', () => {
    const item = evalContents("Thing: do it [s('12')]tag")[0]

    expect(isFrozen(item.source.interpols[0])).toBe(false)
    expect(isFrozen(item.source.substitutions[0])).toBe(false)
  })

  test('rotateInterpolableLine still rotates a frozen substitution (freeze only blocks re-eval)', () => {
    const frozen = evalContents("Thing: do it [s('12')]tag:freeze")[0]
    // sanity: initial value is the first rotation
    expect(frozen.contents).toBe("Thing: do it [1 2]")
    // rotating a frozen substitution works like any other
    expect(rotateInterpolableLine(frozen).contents).toBe("Thing: do it [2 1]")
  })

  // freeze == reuse: a frozen tag keeps its value across re-eval. Proven with
  // memory as the changing DSL input: the command reads memory.get('k'), then
  // re-eval runs against a different memory. A frozen tag ignores the change; a
  // non-frozen one picks it up.
  test('evalRenderLine reuses a frozen substitution instead of re-evaluating it', () => {
    const [[item]] = evalContentsMem("Line: [memory.get('k')]tag:freeze", new Map([['k', 'A']]))
    expect(item.contents).toBe("Line: [A]")

    const reevaluated = evalRenderLine(item, new Map([['k', 'B']]))
    expect(reevaluated.contents).toBe("Line: [A]") // frozen: memory change ignored
  })

  test('evalRenderLine re-evaluates a non-frozen substitution', () => {
    const [[item]] = evalContentsMem("Line: [memory.get('k')]tag", new Map([['k', 'A']]))
    expect(item.contents).toBe("Line: [A]")

    const reevaluated = evalRenderLine(item, new Map([['k', 'B']]))
    expect(reevaluated.contents).toBe("Line: [B]") // not frozen: picks up the change
  })

  test('a non-frozen interpolation can read a frozen sibling via `frozen`', () => {
    // root is frozen; echo reads root's chosen value out of `frozen.root`
    const item = evalContents("Line: [s('C')]root:freeze [j(frozen.root)]echo")[0]

    expect(item.contents).toBe("Line: [C] [C]")
  })

  test('on re-eval, a non-frozen interpolation reads the frozen value that was kept', () => {
    // root frozen to memory 'A'; echo mirrors it. Re-eval against memory 'B'
    // keeps root at 'A', so echo re-derives 'A' from the kept frozen value.
    const [[item]] = evalContentsMem("Line: [memory.get('k')]root:freeze [j(frozen.root)]echo", new Map([['k', 'A']]))
    expect(item.contents).toBe("Line: [A] [A]")

    const reevaluated = evalRenderLine(item, new Map([['k', 'B']]))
    expect(reevaluated.contents).toBe("Line: [A] [A]")
  })
})

describe('fields (cross-substitution access)', () => {
  test('an interpolation reads any sibling via `fields`, not only frozen ones', () => {
    // `a` is a plain (non-frozen) field; `b` reads it out of `fields.a`.
    const item = evalContents("Line: [s('C')]a [j(fields.a)]b")[0]

    expect(item.contents).toBe("Line: [C] [C]")
  })

  test('`frozen` remains an alias for `fields`', () => {
    const item = evalContents("Line: [s('C')]a [j(frozen.a)]b")[0]

    expect(item.contents).toBe("Line: [C] [C]")
  })

  test('a `computed` field resolves last, so it can read a field written after it', () => {
    // `sum` appears before `b` textually, but `computed` defers it to the last
    // pass, by which point both `a` and `b` are in `fields`. `fields.X` is the
    // field's full value list, so it concatenates them.
    const item = evalContents("Line: [fields.a + fields.b]sum:computed [s('A')]a [s('B')]b")[0]

    expect(item.contents).toBe("Line: [AB] [A] [B]")
  })
})

describe('computed rotation', () => {
  test('rotating a source re-derives the computed field from its new value', () => {
    // `a` cycles A B -> B A; `mirror` re-derives from `fields.a` each rotation.
    const item = evalContents("Line: [s('A B')]a [j(fields.a)]mirror:computed")[0]
    expect(item.contents).toBe("Line: [A B] [A B]")

    const rotated = rotateInterpolableLine(item)
    expect(rotated.contents).toBe("Line: [B A] [B A]")
  })

  test('a computed field does not rotate its own list — it always reflects its source', () => {
    // Rotating only the computed field's tag leaves it re-derived from the
    // (unchanged) source rather than cycling a stored list of its own.
    const item = evalContents("Line: [s('A B')]a [j(fields.a)]mirror:computed")[0]
    expect(item.contents).toBe("Line: [A B] [A B]")

    const rotated = rotateInterpolableLine(item, 'mirror')
    expect(rotated.contents).toBe("Line: [A B] [A B]")
  })
})

test('hide tag', () => {
  const line = evalContents("MyScale: play it [`c4 d4 e8 f8`]sheet:hide").flat()[0]
  const subst = line.source.substitutions.find(s => s.tag == 'sheet')

  // The substitution survives with its value, so the sheet display can read it;
  // only the text rendering opts out.
  expect(subst.contents).toStrictEqual(['c4 d4 e8 f8'])
  expect(isHidden(subst)).toBe(true)
  expect(isHidden({ tags: null })).toBe(false)
})
