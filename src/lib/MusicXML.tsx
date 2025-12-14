import { asserts, elements, MusicXML } from '@stringsync/musicxml'
import ToneLib from '../lib/ToneLib'

function attributes() {
  return new elements.Attributes({
    attributes: { divisions: 1 },
    contents: [
      null, // elements.Footnote
      null, // elements.Level
      new elements.Divisions(1), // elements.Divisions
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
    new elements.Slur({attributes: {type: 'start', number: n}}),
    new elements.Slur({attributes: {type: 'stop', number: n}}),
  ]
}

export function note(note, duration, opts) {
  const o = opts || {}

  const tie = o.tied && new elements.Chord || null

  const notehead = o.color && new elements.Notehead({attributes: {color: o.color}}) || null

  const bow = {down: new elements.DownBow(), up: new elements.UpBow()}[o.bow]
  const down = o.bow ? new elements.Technical({contents: [[bow]]}) : null

  const notations =
    new elements.Notations({
      contents: [
        null, // Footnote
        null, // Label
        [o.slur, down].filter(x => x),
      ]
    })

  const alter = ToneLib.getAlter(note)
  const accidental = alter == 0 ? null : new elements.Alter({contents: [alter]})

  return new elements.Note({
    contents: [
      [
        tie, // elements.TiedNote
        new elements.Pitch({
          contents: [
            new elements.Step({
              contents: [ToneLib.getName(note)],
            }),
            accidental,
            new elements.Octave({
              contents: [ToneLib.getOctave(note)],
            }),
          ],
        }),
        new elements.Duration({
          contents: [duration],
        }),
        [], // elements.Tie,
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
      [], // elements.Beam
      new Array<elements.Notations>(notations), // elements.Notations,
      new Array<elements.Lyric>(),
      null, // elements.Play
      null, // elements.Listen
    ],
  })
}

export function measure(attr, ...notes) {
  return new elements.MeasurePartwise({
    attributes: { number: '1' },
    contents: [
      (attr ? [attributes()] : []).concat(...notes)
    ],
  })
}

export function notesToMusic(measures) {
  const musicXml = MusicXML.createPartwise()

  const measuresWithAttributes =
    measures.map((elem, index) =>
      measure(index == 0, elem)
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
