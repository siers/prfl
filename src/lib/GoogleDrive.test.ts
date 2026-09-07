import { describe, expect, test } from 'vitest'
import { DriveFile, findFileByName, normalizeFolderId } from './GoogleDrive.ts'

describe('normalizeFolderId', () => {
  const id = '15T2KT8FdZo4UqrWzpgwIrMcijkkYwPzd'

  test('passes a bare id through', () => {
    expect(normalizeFolderId(id)).toBe(id)
  })

  test('extracts id from a /folders/ URL with a query string', () => {
    expect(normalizeFolderId(`https://drive.google.com/drive/folders/${id}?usp=sharing`)).toBe(id)
  })

  test('extracts id from a /folders/ URL with a fragment', () => {
    expect(normalizeFolderId(`https://drive.google.com/drive/folders/${id}#x`)).toBe(id)
  })

  test('extracts id from an ?id= URL', () => {
    expect(normalizeFolderId(`https://drive.google.com/open?id=${id}`)).toBe(id)
  })

  test('trims surrounding whitespace', () => {
    expect(normalizeFolderId(`  ${id}  `)).toBe(id)
  })
})

describe('findFileByName', () => {
  const file = (name: string): DriveFile => ({ id: name, name, mimeType: 'text/plain' })
  const files = [file('full.rndl'), file('Napkin.rndl'), file('napkin (old).rndl'), file('Scales.rndl')]

  test('matches a name ignoring the extension', () => {
    expect(findFileByName(files, 'Napkin')?.name).toBe('Napkin.rndl')
  })

  test('matches case-insensitively', () => {
    expect(findFileByName(files, 'NAPKIN')?.name).toBe('Napkin.rndl')
  })

  test('matches a substring', () => {
    expect(findFileByName(files, 'cale')?.name).toBe('Scales.rndl')
  })

  test('prefers the shortest name when several match', () => {
    expect(findFileByName([file('napkin (old).rndl'), file('Napkin.rndl')], 'napkin')?.name).toBe('Napkin.rndl')
  })

  test('trims surrounding whitespace', () => {
    expect(findFileByName(files, '  napkin  ')?.name).toBe('Napkin.rndl')
  })

  test('returns undefined when nothing matches', () => {
    expect(findFileByName(files, 'nope')).toBeUndefined()
  })

  test('returns undefined for an empty query', () => {
    expect(findFileByName(files, '   ')).toBeUndefined()
  })
})
