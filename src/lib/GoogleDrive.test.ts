import { describe, expect, test } from 'vitest'
import { normalizeFolderId } from './GoogleDrive.ts'

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
