import OpenSheetMusicDisplay from '../lib/OpenSheetMusicDisplay'
import { asserts, elements, MusicXML } from '@stringsync/musicxml'
import ToneLib from '../lib/ToneLib'
import ToneLibX from '../lib/ToneLibX'

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

function note(note, duration) {
  return new elements.Note({
    contents: [
      [
        null, // elements.TiedNote
        new elements.Pitch({
          contents: [
            new elements.Step({
              contents: [ToneLib.getName(note)],
            }),
            null, // elements.Alter
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

const p = ToneLib.parseNoteUnsafe.bind(ToneLib)

function measure(attr, ...notes) {
  return new elements.MeasurePartwise({
    attributes: { number: '1' },
    contents: [
      (attr ? [attributes()] : []).concat(...notes)
    ],
  })
}

function generateXml() {
  const musicXml = MusicXML.createPartwise()

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
      measure(
        true,
        note(p('d'), 2),
        note(p('a'), 2),
      ),
      measure(
        false,
        note(p('e'), 2),
        note(p('g'), 2),
      ),
    ]),
  ])

  // console.log(musicXml.serialize())

  return musicXml.serialize()
}

function gx() {
  return `
    <?xml version="1.0" encoding="UTF-8"?>
    <score-partwise version="4.0">
      <part-list>
        <score-part id="P1">
          <part-name>Part 1</part-name>
        </score-part>
      </part-list>
      <part id="P1">
        <measure number="1">
          <attributes>
            <time>
              <beats>4</beats>
              <beat-type>4</beat-type>
            </time>
          </attributes>
          <note>
            <pitch>
              <step>C</step>
              <octave>4</octave>
            </pitch>
            <duration>4</duration>
          </note>
        </measure>
      </part>
    </score-partwise>
  `
}

// const r = await fetch('/flash-command/music-min.xml')
// const b = await r.text()
// const cr = await fetch('/flash-command/custom.xml')
// const cb = await cr.text()

console.log((new ToneLibX).keysMajor())

export default function SheetOSMD() {
  return <OpenSheetMusicDisplay file={generateXml()} />
  // return <OpenSheetMusicDisplay file={cb} />
  // return <OpenSheetMusicDisplay file={gx()} />
  // return <OpenSheetMusicDisplay file={b} />
}
