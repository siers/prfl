import { identity } from "lodash";
import { pipe } from "../lib/Function";
import { findMajor, parseNote, renderSheet } from "../lib/ToneLib";
import { positionsForKey } from "../lib/ToneLibViolin";
import { shuffleArray } from "../lib/Random";
import { transpose } from "../lib/Array";

export function gen(fieldsIn: any = undefined) {
  const fields = fieldsIn || {}

  const key = ((fields.key || []).at(0) || 'c') as string
  const blocks = ((fields.blocks || []).at(0) || '') as string
  const flip = ((fields.flip || []).at(0) || '') as string
  const scramble = ((fields.scramble || []).at(0) || '') as string

  const psAll = positionsForKey(findMajor(parseNote(key)!)!)

  const pos = fields.pos ? parseInt(fields.pos) - 1 : 0
  const psRaw = psAll[pos]

  const ps = pipe(
    psRaw,
    flip == 'bw' ? a => a.reverse().map(a => a.reverse()) : identity,
    blocks == 'mixBlocks' ? shuffleArray : identity,
    scramble.match(/ver/) ? a => a.map(shuffleArray) : identity,
    scramble.match(/hor/) ? a => transpose(transpose(a).map(shuffleArray)) : identity,
  )

  return ps.map(p => p.map(n => renderSheet(n, 16)).join(' ')).join(' | ')
}
