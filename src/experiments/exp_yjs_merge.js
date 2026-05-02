// Yjs CRDT merge experiment — real yjs data structures
// Shows how two clients' documents diverge and then sync via encoded updates.
//
// Run with:
//   npx tsx src/experiments/exp_yjs_merge.js

import * as Y from 'yjs'

// ─── Setup: two independent docs ─────────────────────────────────────────────

const docA = new Y.Doc()
const docB = new Y.Doc()

// ─── Y.Text — concurrent character edits ─────────────────────────────────────

const textA = docA.getText('notes')
const textB = docB.getText('notes')

docA.transact(() => { textA.insert(0, 'hello') })
docB.transact(() => { textB.insert(0, 'world') })

// A also deletes the first 'l'
docA.transact(() => { textA.delete(2, 1) })  // "hello" → "helo"

console.log('=== Before merge ===')
console.log('A text:', textA.toString())   // "helo"
console.log('B text:', textB.toString())   // "world"

// ─── State vectors — "what do you know?" ─────────────────────────────────────

const svA = Y.encodeStateVector(docA)
const svB = Y.encodeStateVector(docB)

console.log('\n=== State vectors (encoded Uint8Array) ===')
console.log('A sv:', svA)
console.log('B sv:', svB)

// Decode to inspect the (clientID → clock) map
const svADecoded = Y.decodeStateVector(svA)
const svBDecoded = Y.decodeStateVector(svB)
console.log('A sv decoded:', Object.fromEntries(svADecoded))
console.log('B sv decoded:', Object.fromEntries(svBDecoded))

// ─── Diff updates — "here's what you're missing" ─────────────────────────────

// encodeStateAsUpdateV2(doc, remoteStateVector) → minimal binary patch
const updateAtoB = Y.encodeStateAsUpdateV2(docA, svB)
const updateBtoA = Y.encodeStateAsUpdateV2(docB, svA)

console.log('\n=== Wire updates (binary, bytes) ===')
console.log('A→B update size:', updateAtoB.byteLength)
console.log('B→A update size:', updateBtoA.byteLength)

// ─── Apply and converge ───────────────────────────────────────────────────────

Y.applyUpdateV2(docA, updateBtoA)
Y.applyUpdateV2(docB, updateAtoB)

console.log('\n=== After merge ===')
console.log('A text:', textA.toString())  // both converge to same string
console.log('B text:', textB.toString())  // CRDT guarantees: A === B

// ─── Y.Map — flashcard CardData (LWW semantics) ──────────────────────────────
// In the app, Memory = Map<string, any> with flashcard review timestamps.
// Y.Map gives last-write-wins per key automatically via Lamport clocks.

const cardsA = docA.getMap('cards')
const cardsB = docB.getMap('cards')

// A syncs first so B starts from A's state
const fullUpdateA = Y.encodeStateAsUpdateV2(docA)
Y.applyUpdateV2(docB, fullUpdateA)

// Now both clients independently update the same card
docA.transact(() => { cardsA.set('note-c4', { reviewed: 1700000000000 }) })
docB.transact(() => { cardsB.set('note-c4', { reviewed: 1700000099999 }) })  // B reviewed later

docA.transact(() => { cardsA.set('note-d4', { reviewed: 1700000001000 }) })
docB.transact(() => { cardsB.set('note-e4', { reviewed: 1700000002000 }) })

console.log('\n=== Cards before merge ===')
console.log('A cards:', Object.fromEntries(cardsA))
console.log('B cards:', Object.fromEntries(cardsB))

const svA2 = Y.encodeStateVector(docA)
const svB2 = Y.encodeStateVector(docB)
Y.applyUpdateV2(docA, Y.encodeStateAsUpdateV2(docB, svA2))
Y.applyUpdateV2(docB, Y.encodeStateAsUpdateV2(docA, svB2))

console.log('\n=== Cards after merge (LWW: higher Lamport clock wins) ===')
console.log('A cards:', Object.fromEntries(cardsA))
console.log('B cards:', Object.fromEntries(cardsB))
console.log('note-c4 converged:', JSON.stringify(cardsA.get('note-c4')) === JSON.stringify(cardsB.get('note-c4')))

// ─── Inspect internal structure ───────────────────────────────────────────────

console.log('\n=== Internal Y.Doc store (clientID → clock) ===')
console.log('A final sv:', Object.fromEntries(Y.decodeStateVector(Y.encodeStateVector(docA))))
console.log('B final sv:', Object.fromEntries(Y.decodeStateVector(Y.encodeStateVector(docB))))

// The delete set is encoded inside the update binary; inspect it via decodeUpdateV2
const fullSnapshot = Y.encodeStateAsUpdateV2(docA)
const { structs, ds } = Y.decodeUpdateV2(fullSnapshot)
console.log('\n=== Decoded update structs (first 5) ===')
structs.slice(0, 5).forEach(s => {
  console.log(' ', JSON.stringify({ id: s.id, content: s?.content?.str ?? s?.content?.type ?? '(no str)', deleted: s.deleted }))
})
console.log('Delete set clients:', [...ds.clients.keys()])
