// Spawning a deck from an item's parameters.
//
// An item's "parameters" are its source.substitutions — each carries a list of
// values (the interpolation options that were resolved for it). We expand those
// value-lists into a deck of concrete child items, one per combination:
//
//   * 'cartesian' — every combination across all parameters (M × N × …)
//   * 'zip'       — position-aligned, recycling shorter params up to the longest
//                   (the house zipLongest rule)
//
// Each child is the parent line with its markers replaced by that combination's
// single values, keyed `parentKey-[v1]-[v2]-…` so every combination gets its own
// card/memory entry. The cursor/return-stack mechanics live in RandomizeState;
// this module is the pure parameter → children expansion.

import { InterpolateSubstT } from './RandomizeLangTypes.js'
import { collapseToValues } from './RandomizeLang.js'
import { UserItem, toUserItem } from './RandomizeTypes.js'
import { cartesian, zipLongest } from '../lib/Array.ts'

export type SpawnMode = 'cartesian' | 'zip'

// The distinct values a single substitution offers. Substitution contents is
// already the flat value list, so this is just an identity passthrough kept for
// naming clarity at the call site.
export function substValues(c: InterpolateSubstT): string[] {
  return c
}

export type Param = { marker: string, tag: string | null, values: string[] }

// One Param per substitution, in substitution order — so a combination's i-th
// value lines up with collapseToValues' i-th substitution. An empty
// substitution keeps a single '-' placeholder rather than collapsing the whole
// product to nothing (and to stay aligned).
export function itemParams(item: UserItem): Param[] {
  const subs = item.source?.substitutions || []
  return subs.map(s => {
    const values = substValues(s.contents)
    return { marker: s.marker, tag: s.tag, values: values.length > 0 ? values : ['-'] }
  })
}

// Does this item have anything to spawn? At least one parameter must offer more
// than a single value, else expansion yields just the parent over again.
export function isSpawnable(item: UserItem): boolean {
  return itemParams(item).some(p => p.values.length > 1)
}

function childKey(parentKey: string | null, combo: string[]): string | null {
  if (parentKey === null) return null
  return parentKey + combo.map(v => `-[${v}]`).join('')
}

// Build one child line for a single combination by collapsing each
// interpolation to its chosen value through the lang's own substitute path
// (not a hand-rolled replace). The collapsed source is kept so tags survive on
// the child (each substitution is narrowed to its single chosen value), but
// because every substitution now offers only one value the child is no longer
// spawnable (see isSpawnable).
function childItem(parent: UserItem, combo: string[]): UserItem {
  const collapsed = collapseToValues(parent, combo)
  return toUserItem({
    ...collapsed,
    key: childKey(parent.key, combo),
  })
}

// Expand the item's parameters into child items by the given mode. Returns []
// when there's nothing to expand.
export function spawnChildren(item: UserItem, mode: SpawnMode): UserItem[] {
  const params = itemParams(item)
  if (params.length === 0) return []

  const valueLists = params.map(p => p.values)
  const combos = mode === 'cartesian' ? cartesian(...valueLists) : zipLongest(...valueLists)
  return combos.map(combo => childItem(item, combo))
}

// The deck key the spawned children live under: parent key (or contents) + mode.
export function spawnDeckName(item: UserItem, mode: SpawnMode): string {
  const base = item.key ?? item.contents
  return `${base}/${mode}`
}
