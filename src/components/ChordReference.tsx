import { getChordsForRoot, ROOTS, type Chord } from '../domain/chords'

type ChordReferenceProps = {
  onHome: () => void
}

export function ChordReference({ onHome }: ChordReferenceProps) {
  return (
    <main className="mx-auto w-[min(1440px,calc(100%_-_32px))] py-8 pb-12 max-[760px]:w-[min(1440px,calc(100%_-_20px))] max-[760px]:pt-5">
      <header className="px-0 pt-2 pb-7 max-[760px]:px-2 max-[760px]:pt-1 max-[760px]:pb-[22px]">
        <button className="mb-[34px] border-0 bg-transparent p-0 text-[.9rem] font-bold text-accent-dark hover:text-accent max-[760px]:mb-7" type="button" onClick={onHome}>← Music Tool 首頁</button>
        <p className="mb-[10px] text-[.78rem] font-bold tracking-[.18em] text-accent">CHORD REFERENCE</p>
        <h1 className="mb-3 text-[clamp(2.8rem,7vw,5.8rem)] leading-[.95] tracking-[-.06em] text-[#171a21]">和弦表</h1>
        <p className="m-0 text-[1.05rem] text-[#5e6065]">查看 12 個調的和弦組成音與音程結構</p>
      </header>

      <section className="overflow-hidden rounded-[22px] border border-border bg-white/50 p-2 shadow-[0_15px_45px_rgba(62,50,37,0.07)] max-[760px]:rounded-[18px] max-[760px]:p-[10px]" aria-label="12 個調的和弦組成音與音程結構">
          <table className="w-full table-fixed border-separate border-spacing-2 max-[760px]:block">
          <caption className="sr-only">五種七和弦在 12 個根音上的組成音與音程結構</caption>
          <thead className="max-[760px]:hidden">
            <tr className="align-top">
              <th className="w-[7%] align-top px-[10px] pt-3 pb-[14px] text-left text-[#6d675f]" scope="col">根音</th>
              {getChordsForRoot(ROOTS[0]).map((chord) => (
                <th className="align-top px-[10px] pt-3 pb-[14px] text-left text-[#6d675f]" scope="col" key={chord.quality.symbol}>
                  <QualityHeader chord={chord} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-[760px]:grid max-[760px]:gap-3">
            {ROOTS.map((root) => (
              <tr className="align-top max-[760px]:block max-[760px]:rounded-2xl max-[760px]:border max-[760px]:border-border max-[760px]:bg-[#fffdf9]/60 max-[760px]:p-[14px]" key={root.name}>
                <th className="px-[10px] py-[18px] text-left font-serif text-[1.2rem] text-[#33353a] max-[760px]:block max-[760px]:w-auto max-[760px]:pb-3 max-[760px]:text-[1.35rem]" scope="row">{root.name}</th>
                {getChordsForRoot(root).map((chord) => (
                  <td className="min-w-0 align-top p-0 max-[760px]:mt-[9px] max-[760px]:block" key={chord.quality.symbol}>
                    <div className="hidden items-baseline gap-2 px-1 pb-[5px] max-[760px]:flex">
                      <span className="font-serif text-[1.12rem] font-bold text-accent">{chord.quality.symbol}</span>
                      <small className="text-[.74rem] text-[#6d675f]">{chord.quality.name}</small>
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
    <div className="grid gap-1">
      <strong className="font-serif text-[1.45rem] leading-none text-accent">{chord.quality.symbol}</strong>
      <span className="text-[.78rem] leading-tight text-[#33353a]">{chord.quality.name}</span>
      <small className="text-[.72rem] font-bold tracking-[.02em] text-[#8b8276]">{chord.quality.formula}</small>
    </div>
  )
}

function ChordCell({ chord }: { chord: Chord }) {
  return (
    <div className="grid min-h-[126px] content-start gap-[18px] rounded-[14px] border border-border bg-[#fffdf9]/[.86] px-3 pt-[17px] pb-[15px] shadow-[0_7px_20px_rgba(62,50,37,0.05)] max-[760px]:min-h-0 max-[760px]:grid-cols-[minmax(70px,auto)_1fr] max-[760px]:items-center max-[760px]:gap-3 max-[760px]:px-3 max-[760px]:py-[13px]">
      <strong className="whitespace-nowrap font-serif text-[1.18rem] leading-none text-ink">{chord.symbol}</strong>
      <div className="grid gap-2 max-[760px]:gap-[6px]" aria-label={`${chord.symbol}：${chord.notes.join('、')}`}>
        <div className="grid grid-cols-4 gap-[3px] text-center text-[.72rem] font-bold text-[#8b8276]">
          {chord.degrees.map((degree) => <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" key={degree}>{degree}</span>)}
        </div>
        <div className="grid grid-cols-4 gap-[3px] text-center font-serif text-[.98rem] text-[#33353a]">
          {chord.notes.map((note, index) => <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" key={`${note}-${index}`}><ChordNote note={note} /></span>)}
        </div>
      </div>
    </div>
  )
}

function ChordNote({ note }: { note: string }) {
  return (
    <span className="inline-flex items-baseline justify-center leading-none">
      <span className="leading-none">{note[0]}</span>
      {note.slice(1) && <span className="ml-[.02em] inline-block translate-y-[.04em] text-[.86em] leading-none">{note.slice(1)}</span>}
    </span>
  )
}
