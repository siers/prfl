import { describe, expect, test } from 'vitest'
import * as actual from './SheetNotation'
import type * as documented from './SheetNotation.api'

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never

const declarationMatchesModule: Exact<typeof documented, typeof actual> = true

describe('SheetNotation.api.d.ts', () => {
  test('documents the module exactly', () => { expect(declarationMatchesModule).toBe(true) })
})
