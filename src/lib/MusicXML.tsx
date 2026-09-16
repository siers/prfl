// @ts-nocheck — glue against the deeply-typed @stringsync/musicxml schema; the
// exact generated tuple shapes aren't worth chasing here.
import { asserts, elements, MusicXML } from '@stringsync/musicxml'
import * as ToneLib from '../lib/ToneLib'
import type { SheetMeasure } from './SheetNotation'

function attributes() {
  return new elements.Attributes({
    //attributes: { divisions: 1 },
    contents: [
      null, // elements.Footnote
      null, // elements.Level
      new elements.Divisions({ contents: [4] }), // elements.Divisions
      new Array<elements.Key>(),
      new Array<elements.Time>(
        new elements.Time({
          contents: [
            [
              [
                [
                  new elements.Beats({
                    contents: ['4'],
                  }),
                  new elements.BeatType({
                    contents: ['4'],
                  }),
                ],
              ],
              null,
            ],
          ],
        })
      ),
      null, // elements.Staves
      null, // elements.PartSymbol
      null, // elements.Instruments
      new Array<elements.Clef>(),
      new Array<elements.StaffDetails>(),
      new Array<elements.Transpose>(),
      new Array<elements.Directive>(),
      new Array<elements.MeasureStyle>(),
    ],
  })
}

export function slurMarkers(n) {
  return [
    new elements.Slur({ attributes: { type: 'start', number: n } }),
    new elements.Slur({ attributes: { type: 'stop', number: n } }),
  ]
}

// A rest is a note whose Pitch slot holds <rest/> instead.
export function rest(duration): elements.Note {
  return new elements.Note({
    contents: [
      [
        null, // elements.Chord
        new elements.Rest({}),
        new elements.Duration({ contents: [duration] }),
        [], // elements.Tie
      ],
      new Array<elements.Instrument>(),
      null, // elements.Footnote
      null, // elements.Level
      null, // elements.Voice
      null, // elements.Type
      new Array<elements.Dot>(),
      null, // elements.Accidental
      null, // elements.TimeModification
      null, // elements.Stem
      null, // elements.Notehead
      null, // elements.NoteheadText
      null, // elements.Staff
      [], // elements.Beam
      new Array<elements.Notations>(),
      new Array<elements.Lyric>(),
      null, // elements.Play
      null, // elements.Listen
    ],
  })
}

export function note(note, duration, opts?): elements.Note {
  const o = opts || {}

  // A tie is two elements in two places, and MusicXML means different things by them:
  // <tie> is the SOUND (one sustained note), <tied> inside <notations> is the printed
  // slur. An engraver draws from <tied>, a player reads <tie>, so a tie needs both or
  // it is silent in one of them. `tied` starts one here, `tieStop` ends the one before.
  const ties = [
    o.tieStop && new elements.Tie({ attributes: { type: 'stop' } }),
    o.tied && new elements.Tie({ attributes: { type: 'start' } }),
  ].filter(x => x)

  const tieds = [
    o.tieStop && new elements.Tied({ attributes: { type: 'stop' } }),
    o.tied && new elements.Tied({ attributes: { type: 'start' } }),
  ].filter(x => x)

  const noteheadContents = o.notehead ? [o.notehead] : ['normal']
  const notehead = (o.color || o.filled || o.notehead)
    && new elements.Notehead({ attributes: { color: o.color, filled: o.filled }, contents: noteheadContents })
    || null

  // Bowing and fingering are both <technical>, and MusicXML allows only one per
  // <notations> — so they share an element rather than each bringing their own.
  const bowing = { down: new elements.DownBow(), up: new elements.UpBow() }[o.bowing]
  const fingering = o.text ? new elements.Fingering({ contents: [String(o.text)] }) : null
  const technicals = [bowing, fingering].filter(x => x)
  const technical = technicals.length > 0 ? new elements.Technical({ contents: [technicals] }) : null

  const notations =
    new elements.Notations({
      contents: [
        null, // Footnote
        null, // Label
        [...tieds, o.slur, technical].filter(x => x),
      ]
    })

  const accidental = note.alter == 0 ? null : new elements.Alter({ contents: [note.alter] })

  const beam = o.beam ? [new elements.Beam({ attributes: { number: o.beamNumber }, contents: [o.beam] })] : []
  // const beam = opts.beam && [new elements.Beam({ contents: [opts.beam] })] || []

  return new elements.Note({
    contents: [
      [
        null, // elements.Chord
        new elements.Pitch({
          contents: [
            new elements.Step({
              contents: [note.name.toUpperCase()],
            }),
            accidental,
            new elements.Octave({
              contents: [note.octave],
            }),
          ],
        }),
        new elements.Duration({
          contents: [duration],
        }),
        ties, // elements.Tie
      ],
      new Array<elements.Instrument>(),
      null, // elements.Footnote
      null, // elements.Level
      null, // elements.Voice
      null, // elements.Type
      new Array<elements.Dot>(),
      null, // elements.Accidental
      null, // elements.TimeModification
      null, // elements.Stem
      notehead, // elements.Notehead
      null, // elements.NoteheadText
      null, // elements.Staff
      beam, // elements.Beam
      new Array<elements.Notations>(notations), // elements.Notations,
      new Array<elements.Lyric>(),
      null, // elements.Play
      null, // elements.Listen
    ],
  })
}

export function measure(attr, notes, number = 1) {
  return new elements.MeasurePartwise({
    attributes: { number: String(number) },
    contents: [
      (attr ? [attributes()] : []).concat(notes)
    ],
  })
}

// Parsed notation to engraver elements, in one place because a tie spans two notes:
// the `~` sits on the FIRST, but the second is the one that must carry <tie type="stop">.
// Doing it per call site meant each of them re-deriving that pairing, so none did.
//
// A tie crosses bar lines — that is most of what ties are for — so the carry is tracked
// across measures rather than reset per measure. A rest breaks it: `tied` is refused on
// a rest upstream, and nothing can be held through one.
export function sheetToNotes(measures: SheetMeasure[]): elements.Note[][] {
  let carry = false

  return measures.map(m => m.map(n => {
    const tieStop = carry
    carry = !!n.tied

    return n.note
      ? note(n.note, n.duration, {
        bowing: n.bowing, color: n.color, notehead: n.shape, text: n.text,
        tied: n.tied, tieStop,
      })
      : rest(n.duration)
  }))
}

export function notesToMusic(measures) {
  const musicXml = MusicXML.createPartwise()

  const measuresWithAttributes =
    measures.map((elem, index) =>
      measure(index == 0, elem, index + 1)
    )

  musicXml
    .getRoot()
    .setPartList(
      new elements.PartList({
        contents: [
          new Array<elements.PartGroup>(),
          new elements.ScorePart({
            attributes: { id: 'P1' },
            contents: [
              null, // elements.Identification
              new Array<elements.PartLink>(),
              new elements.PartName({ contents: ['Part 1'] }),
              null, // elements.PartNameDisplay
              null, // elements.PartAbbreviation
              null, // elements.PartAbbreviationDisplay
              new Array<elements.Group>(),
              new Array<elements.ScoreInstrument>(),
              new Array<elements.Player>(),
              new Array<elements.MidiDevice | elements.MidiInstrument>(),
            ],
          }),
          new Array<elements.PartGroup | elements.ScorePart>(),
        ],
      })
    )
    .setParts([
      new elements.PartPartwise({
        attributes: { id: 'P1' },
      }).setMeasures([
        ...measuresWithAttributes
      ]),
    ])

  return musicXml.serialize()
}
