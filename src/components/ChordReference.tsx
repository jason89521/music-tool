import { getChordsForRoot, ROOTS, type Chord } from '../domain/chords'

type ChordReferenceProps = {
  onHome: () => void
}

export function ChordReference({ onHome }: ChordReferenceProps) {
  return (
    <main className="chord-shell">
      <header className="chord-header">
        <button className="back-button" type="button" onClick={onHome}>← Music Tool 首頁</button>
        <p className="eyebrow">CHORD REFERENCE</p>
        <h1>和弦表</h1>
        <p>查看 12 個調的和弦組成音與音程結構</p>
      </header>

      <section className="chord-reference" aria-label="12 個調的和弦組成音與音程結構">
        <table className="chord-table">
          <caption className="visually-hidden">五種七和弦在 12 個根音上的組成音與音程結構</caption>
          <thead>
            <tr>
              <th scope="col">根音</th>
              {getChordsForRoot(ROOTS[0]).map((chord) => (
                <th scope="col" key={chord.quality.symbol}>
                  <QualityHeader chord={chord} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROOTS.map((root) => (
              <tr key={root.name}>
                <th className="root-heading" scope="row">{root.name}</th>
                {getChordsForRoot(root).map((chord) => (
                  <td key={chord.quality.symbol}>
                    <div className="mobile-quality">
                      <span>{chord.quality.symbol}</span>
                      <small>{chord.quality.name}</small>
                    </div>
                    <ChordCell chord={chord} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}

function QualityHeader({ chord }: { chord: Chord }) {
  return (
    <div className="quality-header">
      <strong>{chord.quality.symbol}</strong>
      <span>{chord.quality.name}</span>
      <small>{chord.quality.formula}</small>
    </div>
  )
}

function ChordCell({ chord }: { chord: Chord }) {
  return (
    <div className="chord-cell">
      <strong className="chord-symbol">{chord.symbol}</strong>
      <div className="chord-correspondence" aria-label={`${chord.symbol}：${chord.notes.join('、')}`}>
        <div className="chord-row chord-degrees">
          {chord.degrees.map((degree) => <span key={degree}>{degree}</span>)}
        </div>
        <div className="chord-row chord-notes">
          {chord.notes.map((note, index) => <ChordNote key={`${note}-${index}`} note={note} />)}
        </div>
      </div>
    </div>
  )
}

function ChordNote({ note }: { note: string }) {
  return (
    <span className="chord-note">
      <span className="chord-note-letter">{note[0]}</span>
      {note.slice(1) && <span className="chord-note-accidental">{note.slice(1)}</span>}
    </span>
  )
}
