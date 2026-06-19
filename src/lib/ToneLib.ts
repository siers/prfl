// https://en.wikipedia.org/wiki/Piano_key_frequencies

import { Set } from 'immutable'
import _ from 'lodash'
import { arrayShift, times } from './Array'

type Name = 'c' | 'd' | 'e' | 'f' | 'g' | 'a' | 'b'

export const names: Name[] = ['c', 'd', 'e', 'f', 'g', 'a', 'b']
// const namesMap: Record<Name, number> = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 }
const namesSemiMap = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

const intervalMap = {
  0: 'unison',
  1: 'second',
  2: 'third',
  3: 'fourth',
  4: 'fifth',
  5: 'sixth',
  6: 'seventh',
}

const alters: Record<number, string> = { 0: '', 1: '#', '-1': 'b', 2: '##', '-2': 'bb' }
const altersMap: Record<string, number> = { '': 0, '#': 1, 'b': -1, '##': 2, 'bb': -2 }

export interface Note {
  name: Name,
  alter: number,
  octave: number,
}

export type Key = Note[] // semantic distinction only, unfortunately
type Notes = Note[]

export function semi(n: Note): number {
  return 4 + (n.octave - 1) * 12 + namesSemiMap[n.name] + n.alter
}

export function render(n: Note, octave: Boolean = true): string {
  const alt = alters[n.alter] ?? '?'
  return n.name.toUpperCase() + alt + (octave ? n.octave : '')
}

const sharp = 1
const flat = -1

// steps in key
// const unison = 0
const second = 1
const third = 2
const fourth = 3
const fifth = 4
// const sixth = 5
const seventh = 6
const octave = 7
const ninth = 8

const c4: Note = parseNote('c')!
const c1: Note = parseNote('c1')!

export function parseNote(note: string): Note | null {
  const match = note.toLowerCase().match(/^(?<note>[abcdefg])(?<accds>[b#]{0,2})?(?<octave>[0-9])?$/)

  if (!match) return null
  if (!match.groups) return null

  const octave = parseInt(match.groups.octave || '4', 10)
  const name = match.groups.note as Name
  const alter = altersMap[match.groups.accds || ''] as number

  return { name, alter, octave }
}

function signedHash(value: number, positivePrime: number, negativePrime: number): number {
  const prime = value >= 0 ? positivePrime : negativePrime
  return prime ** Math.abs(value)
}

function hashNote(n: Note): number {
  return 2 ** names.indexOf(n.name) * signedHash(n.alter, 3, 5) * 7 ** n.octave
}

// I hate javascript
function uniqueNotes(n: Notes): Notes {
  const uniq: Record<number, Note> = {}
  n.forEach(n => uniq[hashNote(n)] = n)
  return Object.values(uniq)
}

const allNotesGenerated: Note[] = allNotes()

export function enharmonics(semiTarget: number): Note[] {
  const spectrum = uniqueNotes([...allNotesGenerated].map(normalize))
  const found = spectrum.filter(n => semi(n) % 12 == semiTarget % 12)

  return found.map(n => ({ ...n, octave: semiOctaves(semiTarget) }))
}

function semiOctaves(semiIn: number): number {
  return Math.floor((semiIn - semi(c1)) / 12) + 1
}

function addAccidental(note: Note, accidental: number): Note {
  return { ...note, alter: note.alter + accidental }
}

export function addInterval(note: Note, interval: number): Note {
  if (interval == 0) return note
  if (Math.abs(interval) > 200) return note
  return times(Math.abs(interval)).reduce((n) => interval > 0 ? stepUp(n) : stepDown(n), note)
}

function stepUp(n: Note): Note {
  const idx = names.indexOf(n.name)
  if (idx < names.length - 1) {
    return { ...n, name: names[idx + 1] }
  } else {
    return { ...n, name: names[0], octave: n.octave + 1 }
  }
}

function stepDown(n: Note): Note {
  const idx = names.indexOf(n.name)
  if (idx > 0) {
    return { ...n, name: names[idx - 1] }
  } else {
    return { ...n, name: names[names.length - 1], octave: n.octave - 1 }
  }
}

// semi here should be semantically wrong
function stepTo(n: Note, to: Note): Note {
  const next = semi(to) >= semi(n) ? stepUp(n) : stepDown(n)
  if (next.name === to.name) return { ...next, alter: to.alter }
  return next
}

export function nameInterval(int: number) {
  return intervalMap[Math.abs(int) % 7]
}

// old, wrong comment: property key(note, base) = key(note), only octave is changed
export function rebase(note: Note, base: Note): Note {
  const distanceA = names.indexOf(note.name) // * base.octave * 8
  const distanceB = names.indexOf(base.name) // * base.octave * 8
  const before = distanceA < distanceB
  return { name: note.name, alter: note.alter, octave: base.octave + (before ? 1 : 0) }
}

export function normalize(n: Note): Note {
  return rebase(n, c4)
}

export function rebaseSemi(note: Note, semiBase: number): Note {
  return rebase(note, enharmonics(semiBase)[0])
}

export function equalNote(a: Note, b: Note): boolean {
  return a.name == b.name && a.alter == b.alter
}

// === Keys

function keyAddAccidental(key_: Key, n: number, sign: number): Key {
  const key = structuredClone(key_)
  if (key[n]) key[n] = addAccidental(key[n], sign)
  return key
}

function keyRebase(key: Key, base: Note): Key {
  return key.map(n => rebase(n, base))
}

export function major(): Key {
  return 'cdefgab'.split('').map(n => parseNote(n)!)
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
  return [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7].map(d => {
    return modulateFifth(major(), d)
  })
}

export function findMajor(tonic: Note): Key | undefined {
  return keysMajor().find(k => equalNote(rebase(k[0], c4), rebase(tonic, c4)))
}

// === Utilities & Computations

export function findCommonKey(a: number, b: number): [Key, [Note, Note]] | undefined {
  var af, bf
  var key = keysMajor().find(k => {
    af = k.find((note: Note) => semi(note) % 12 == a % 12)
    bf = k.find((note: Note) => semi(note) % 12 == b % 12)

    return af && bf
  })

  if (key) {
    return [key, [af!, bf!]]
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

export function allNotes(): Notes {
  return keysMajor().flat()
}

export function allNotesRendered(): Set<string> {
  return normalizedNotesRendered(keysMajor().flat())
}

export function normalizedNotesRendered(k: Notes): Set<string> {
  return Set(k.map(n => render(normalize(n), false)))
}

export function notesMissing(k: Key, l: Key): Set<string> {
  return allNotesRendered().subtract(normalizedNotesRendered(k).union(normalizedNotesRendered(l)))
}

export function keyCenters(mode: number = 0): Note[] {
  const keys = _.sortBy(keysMajor(), ks => semi(ks[0]))
  return keys.map(k => k[mode % keys[0].length])
}

// NOTE: this really could be just [0, 11]
export function keySemis(mode: number = 0): number[] {
  return keyCenters(mode).map(k => semi(normalize(k)))
}

export function keysBySemi(n: number): Note[] {
  const centers = keyCenters()
  return enharmonics(n).flatMap(e => centers.filter(c => equalNote(c, e)))
}

export function pointwiseInterval(a: Note, b: Note, ...cs: Note[]): Note[] {
  if (a.name === b.name && a.octave === b.octave) return []
  const next = stepTo(a, b)
  if (next.name === b.name && next.octave === b.octave && cs.length == 0) return [a, b]
  if (next.name === b.name && next.octave === b.octave && cs.length != 0) {
    const [c, ...css] = cs
    return [a, ...pointwiseInterval(b, c, ...css)]
  }
  return [a, ...pointwiseInterval(next, b, ...cs)]
}

// respell a note by its letter into a specific key
// if you give an ill-defined key, it will blow up
export function rename(a: Note, k: Key) {
  return { ...a, alter: k.find(n => n.name == a.name)!.alter }
}
