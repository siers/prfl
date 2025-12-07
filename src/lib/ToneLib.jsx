class ToneLib {
  names = 'CDEFGAB'.split('')
  namesMap = {c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6}

  alters = {0: '', 1: '#', '-1': 'b', 2: '##', '-2': 'bb'} // todo: use
  altersMap = {'': 0, '#': 1, 'b': -1, '##': 2, 'bb': -2}

  arrayShift(arr, count) {
    const len = arr.length
    const c = len - count
    arr.push(...arr.splice(0, (-c % len + len) % len))
    return arr
  }

  getName(note) {
    return this.names[note.name]
  }

  getOctave(note) {
    return Math.floor((note.semi - 4) / 12) + 1
  }

  renderNote({semi, name, alter}, renderOctave = true) {
    const octave = Math.floor((semi - 4) / 12) + 1
    const alt = this.alters[alter] === undefined ? '?' : this.alters[alter]

    if (alt == '?') console.log(`bad alter: ${alter}`)

    return this.names[name] + alt + (renderOctave ? octave : '')
  }

  // TODO: this should be a computed property of a Note object
  noteWithRender(note) {
    return {...note, render: this.renderNote(note)}
  }

  sharp = 1
  flat = -1

  // steps in key
  unison = 0
  second = 1
  third = 2
  fourth = 3
  fifth = 4
  sixth = 5
  seventh = 6
  octave = 7
  ninth = 8

  parseNote(note) {
    const match = note.toLowerCase().match(/^(?<note>[abcdefg])(?<accds>[b#]{0,2})?(?<octave>[0-9])?$/)

    if (!match) return null
    if (!match.groups.note === undefined) return null

    const semi = parseInt(match.groups.octave || 4, 10) * 12
    const name = this.namesMap[match.groups.note]
    const alter = this.altersMap[match.groups.accds || '']

    return this.noteWithRender({semi, name, alter})
  }

  addAccidental({semi, name, alter}, accidental) {
    return this.noteWithRender({semi: semi + accidental, name, alter: alter + accidental})
  }

  addSharp(note) {
    return this.addAccidental(note, this.sharp)
  }

  addFlat(note) {
    return this.addAccidental(note, this.flat)
  }

  // property key(note, base) = key(note), only octave is changed
  rebase({semi, name, alter, render}, baseSemi) {
    return this.noteWithRender({
      semi: baseSemi + ((12000 + semi - baseSemi) % 12),
      name,
      alter,
    })
  }

  major() {
    return [
      {semi: 49 + 3 + 0, name: 0, alter: 0},
      {semi: 49 + 3 + 2, name: 1, alter: 0},
      {semi: 49 + 3 + 4, name: 2, alter: 0},
      {semi: 49 + 3 + 5, name: 3, alter: 0},
      {semi: 49 + 3 + 7, name: 4, alter: 0},
      {semi: 49 + 3 + 9, name: 5, alter: 0},
      {semi: 49 + 3 + 11, name: 6, alter: 0},
    ].map(n => this.noteWithRender(n))
  }

  keyAddAccidental(keyOld, n, sign) {
    const key = structuredClone(keyOld)
    key[n] = this.addAccidental(key[n], sign)
    return key
  }

  keyRebase(key, baseSemi) {
    return key.map(n => this.rebase(n, baseSemi))
  }

  // semitones are unordered, but not names and order is correct
  modulateFifthBaseless(key, direction) {
    switch (direction) {
      case 1: return this.arrayShift(this.keyAddAccidental(key, this.fourth, this.sharp), this.fifth)
      case -1: return this.arrayShift(this.keyAddAccidental(key, this.seventh, this.flat), this.fourth)
      case 0: return key
      default:
        return this.modulateFifth(this.modulateFifth(key, direction - Math.sign(direction)), Math.sign(direction))
    }
  }

  modulateFifth(key, direction) {
    const modulated = this.modulateFifthBaseless(key, direction)
    return this.keyRebase(modulated, modulated[0].semi)
  }

  findCommonKey(a, b) {
    var af, bf
    var key = this.keysMajor().find(k => {
      af = k.find(({semi}) => semi % 12 == a % 12)
      bf = k.find(({semi}) => semi % 12 == b % 12)

      return af && bf
    })

    if (key) {
      return [key, [af, bf]]
    } else {
      console.log(`finding common key failed for ${a}/${b}`)
    }
  }

  keysMajor() {
    return [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6].map(d => {
      return this.modulateFifth(this.major(), d)
    })
  }

  keysDominant() {
    return this.keysMajor().map(k => this.keyAddAccidental(k, this.seventh, -1))
  }

  keysDominantFlatNine() {
    return this.keysDominant().map(k => this.keyAddAccidental(k, this.second, -1))
  }

  nameLeadingDim7() {
    return this.keysDominantFlatNine().map(k => [this.third, this.fifth, this.seventh, this.ninth % this.octave].map(n => k[n].render).join(' '))
    // return this.keysDominantFlatNine().map(k => k[0].render + ": " + [this.third, this.fifth, this.seventh, this.second].map(n => k[n].render).join(' '))
  }

  noteKeyAssociations(sort = true) {
    const keys = {}
    this.keysMajor().forEach(key =>
      key.forEach(note => {
        const r = this.renderNote(note, false)
        keys[r] = (keys[r] || []).concat([this.renderNote(key[0], false)])
      })
    )
    const sorted = Object.entries(keys).sort((a, b) => {
      const cmp = tonic => {
        const s = tonic.indexOf('#') != -1 && 100
        const f = tonic.indexOf('b') != -1 && -100
        const weights = "CDEFGAB".indexOf(tonic[0])
        return s + f + weights
      }
      cmp(b) - cmp(a)
    })
    return sort ? sorted : Object.entries(keys).sort((a, b) => {
      return "CDEFGAB".indexOf(a[0][0]) - "CDEFGAB".indexOf(b[0][0])
    })
  }

  testParseAndRender() {
    this.keysMajor().forEach(key => {
      key.forEach(note => {
        const renders = [note.render, this.parseNote(note.render).render]
        if (renders[0] != renders[1]) console.log(`failed parse/render cycle: ${renders}`)
      })
    })
  }

  // ToneLib.noteKeyAssociations().map(kAndKs => console.log(`${kAndKs[0]}: ${kAndKs[1].join(',')}`))
  // Ab: Eb,Ab,Db,Gb
  // G#: A,E,B,F#
  //
  // Bb: F,Bb,Eb,Ab,Db,Gb
  // A#: B,F#
  //
  // Db: Ab,Db,Gb
  // C#: D,A,E,B,F#
  //
  // Eb: Bb,Eb,Ab,Db,Gb
  // D#: E,B,F#
  //
  // F#: G,D,A,E,B,F#
  // Gb: Db,Gb
  //
  // C: C,G,F,Bb,Eb,Ab,Db
  // D: C,G,F,D,Bb,A,Eb
  // E: C,G,F,D,A,E,B
  //
  // F: C,F,Bb,Eb,Ab,Db,Gb
  // E#: F#
  //
  // G: C,G,F,D,Bb,Eb,Ab
  // A: C,G,F,D,Bb,A,E
  //
  // B: C,G,D,A,E,B,F#
  // Cb: Gb

  // modulateFifth(major, -1).map(n => log(JSON.stringify(n) + ' ' + renderNote(n)))
  // log()
  // modulateFifth(major, 1).map(n => log(JSON.stringify(n) + ' ' + renderNote(n)))
  // log(keysMajor.map(k => renderNote(k[0])).join())
}

// https://en.wikipedia.org/wiki/Piano_key_frequencies

window.ToneLib = new ToneLib
export default ToneLib = new ToneLib
ToneLib.testParseAndRender()
