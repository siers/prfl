import { describe, expect, test } from 'vitest'
import { findTriadOnString, strings } from './ToneLibViolin.ts'
import { parseNote, render } from './ToneLib.ts'

describe('ToneLibViolin', () => {
  test('basic', () => {
    strings.forEach(string => string.positions2.forEach(p => expect(p.alter).toEqual(0)))
  })

  test('find triad', () => {
    expect(findTriadOnString(parseNote('G')!, 'G').map(n => render(n)).join(' ')).toEqual('B3 D4 G4 B4')
    expect(findTriadOnString(parseNote('E')!, 'G').map(n => render(n)).join(' ')).toEqual('G#3 B3 E4 G#4')
    expect(findTriadOnString(parseNote('Eb')!, 'G').map(n => render(n)).join(' ')).toEqual('Bb3 Eb4 G4 Bb4')
    expect(findTriadOnString(parseNote('Bb')!, 'G').map(n => render(n)).join(' ')).toEqual('Bb3 D4 F4 Bb4')

    expect(findTriadOnString(parseNote('A')!, 'E').map(n => render(n)).join(' ')).toEqual('A5 C#6 E6 A6')
  })
})
