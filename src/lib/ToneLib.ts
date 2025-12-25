// # note interface
// - dat: name (mby enum), alter, octave
//   derived: semi = c1 + octave * 12 + letter offset
//   derived: render
//   derived spelling = (name, alter)

// https://en.wikipedia.org/wiki/Piano_key_frequencies

type Name = 'c' | 'd' | 'e' | 'f' | 'g' | 'a' | 'b'

const names: Name[] = ['c', 'd', 'e', 'f', 'g', 'a', 'b']
// const namesMap: Record<Name, number> = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 }
const namesSemiMap = { c: 0, d: 2, e: 3, f: 5, g: 7, a: 9, b: 11 }

const alters: Record<number, string> = { 0: '', 1: '#', '-1': 'b', 2: '##', '-2': 'bb' }
const altersMap: Record<string, number> = { '': 0, '#': 1, 'b': -1, '##': 2, 'bb': -2 }

interface Note {
  name: Name,
  alter: number,
  octave: number,
}

type Key = Note[]

function arrayShift<A>(arr: A[], count: number): A[] {
  const len = arr.length
  const c = len - count
  arr.push(...arr.splice(0, (-c % len + len) % len))
  return arr
}

function tupleLexSort<T extends any[]>(tuples: T[]): T[] {
  return tuples.sort((a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] < b[i]) return -1;
      if (a[i] > b[i]) return 1;
    }
    return a.length - b.length;
  });
}

function semi(n: Note): number {
  return 4 + n.octave * 12 + namesSemiMap[n.name] + n.alter
}

function spelling(n: Note): [Name, number] {
  return [n.name, n.alter]
}

export function render(n: Note, octave: Boolean = true) {
  const alt = alters[n.alter] ?? '?'
  return n.name.toUpperCase() + alt + (octave ? n.octave : '')
}

const sharp = 1
const flat = -1

// steps in key
const unison = 0
const second = 1
const third = 2
const fourth = 3
const fifth = 4
const sixth = 5
const seventh = 6
const octave = 7
const ninth = 8

const c4: Note = parseNote('c')!

export function parseNote(note: string): Note | null {
  const match = note.toLowerCase().match(/^(?<note>[abcdefg])(?<accds>[b#]{0,2})?(?<octave>[0-9])?$/)

  if (!match) return null
  if (!match.groups) return null

  const octave = parseInt(match.groups.octave || '4', 10)
  const name = match.groups.note as Name
  const alter = altersMap[match.groups.accds || ''] as number

  return { name, alter, octave }
}

function addAccidental(note: Note, accidental: number): Note {
  return { ...note, alter: note.alter + accidental }
}

// property key(note, base) = key(note), only octave is changed
export function rebase(note: Note, base: Note): Note {
  const distanceA = names.indexOf(note.name) // * base.octave * 8
  const distanceB = names.indexOf(base.name) // * base.octave * 8
  const before = distanceA < distanceB
  return { name: note.name, alter: note.alter, octave: base.octave + (before ? 1 : 0) }
}

export function major(): Key {
  return 'cdefgab'.split('').map(n => parseNote(n)!)
}

function keyAddAccidental(key_: Key, n: number, sign: number): Key {
  const key = structuredClone(key_)
  if (key[n]) key[n] = addAccidental(key[n], sign)
  return key
}

function keyRebase(key: Key, base: Note): Key {
  return key.map(n => rebase(n, base))
}

function modulateFifth(key: Key, direction: number) {
  const modulated: Key = (() => {
    switch (direction) {
      case 1: return arrayShift(keyAddAccidental(key, fourth, sharp), fifth)
      case -1: return arrayShift(keyAddAccidental(key, seventh, flat), fourth)
      case 0: return key
      default:
        return modulateFifth(modulateFifth(key, direction - Math.sign(direction)), Math.sign(direction))
    }
  })()

  return keyRebase(modulated, rebase(modulated[0], c4))
}

export function keysMajor() {
  return [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6].map(d => {
    return modulateFifth(major(), d)
  })
}

export function findCommonKey(a: number, b: number) {
  var af, bf
  var key = keysMajor().find(k => {
    af = k.find((note: Note) => semi(note) % 12 == a % 12)
    bf = k.find((note: Note) => semi(note) % 12 == b % 12)

    return af && bf
  })

  if (key) {
    return [key, [af, bf]]
  } else {
    console.log(`finding common key failed for ${a}/${b}`)
  }
}

export function majorKey(note: Note): Key | undefined {
  return keysMajor().find(k => render(k[0], false) == render(note, false))
}

function keysDominant() {
  return keysMajor().map(k => keyAddAccidental(k, seventh, -1))
}

function keysDominantFlatNine() {
  return keysDominant().map(k => keyAddAccidental(k, second, -1))
}

export function nameLeadingDim7(): string[] {
  return keysDominantFlatNine().map(k => [third, fifth, seventh, ninth % octave].map(n => render(k[n])).join(' '))
}

// export function noteKeyAssociations(sort = true) {
//   const keys = {}
//   keysMajor().forEach(key =>
//     key.forEach(note => {
//       const r = render(note, false)
//       keys[r] = (keys[r] || []).concat([render(key[0], false)])
//     })
//   )
//   const sorted = Object.entries(keys).sort((a, b) => {
//     const cmp = tonic => {
//       const s = tonic.indexOf('#') != -1 && 100
//       const f = tonic.indexOf('b') != -1 && -100
//       const weights = "CDEFGAB".indexOf(tonic[0])
//       return s + f + weights
//     }
//     cmp(b) - cmp(a)
//   })
//   return sort ? sorted : Object.entries(keys).sort((a, b) => {
//     return "CDEFGAB".indexOf(a[0][0]) - "CDEFGAB".indexOf(b[0][0])
//   })
// }

// function allNotes() {
//   const c4 = parseNote('C4')
//   return keysMajor().flat().map(n => rebase(n, c4.semi))
// }
