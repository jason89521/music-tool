import { useCallback, useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.js'
import {
  addSong,
  audioPracticeDb,
  deleteSection,
  deleteSong,
  savePreference,
  saveSection,
  type PracticeSection,
  type PracticeSong,
} from '../audioPractice/database'
import { formatTime, isValidInterval, parseTime } from '../audioPractice/time'

const ACCEPTED_AUDIO = new Set(['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/wave'])

function isSupportedAudio(file: File): boolean {
  return ACCEPTED_AUDIO.has(file.type.toLowerCase()) || /\.(mp3|m4a|wav)$/i.test(file.name)
}

function newId(): string {
  return crypto.randomUUID()
}

export function AudioPractice({ onHome }: { onHome: () => void }) {
  const [songs, setSongs] = useState<PracticeSong[]>([])
  const [sections, setSections] = useState<PracticeSection[]>([])
  const [selectedSongId, setSelectedSongId] = useState<string>()
  const [selectedSectionId, setSelectedSectionId] = useState<string>()
  const [draft, setDraft] = useState<{ id: string; start: number; end: number }>()
  const [startText, setStartText] = useState('00:00.00')
  const [endText, setEndText] = useState('00:00.00')
  const [sectionName, setSectionName] = useState('')
  const [loop, setLoop] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [renameSong, setRenameSong] = useState(false)
  const [renameSection, setRenameSection] = useState(false)
  const waveformRef = useRef<HTMLDivElement>(null)
  const waveSurferRef = useRef<WaveSurfer | undefined>(undefined)
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | undefined>(undefined)
  const activeRegionRef = useRef<Region | undefined>(undefined)
  const sectionsRef = useRef(sections)
  const selectedSectionRef = useRef(selectedSectionId)
  const loopRef = useRef(loop)
  const playbackRateRef = useRef(1)
  const lastPreferenceWriteRef = useRef(0)
  const selectedSong = songs.find((song) => song.id === selectedSongId)
  const playbackRate = selectedSong?.playbackRate ?? 1
  const selectedSection = sections.find((section) => section.id === selectedSectionId)
  const activeInterval = draft
    ? { start: draft.start, end: draft.end }
    : selectedSection
      ? { start: selectedSection.start, end: selectedSection.end }
      : selectedSong ? { start: 0, end: selectedSong.duration } : undefined
  const enteredStart = parseTime(startText)
  const enteredEnd = parseTime(endText)
  const enteredIntervalValid = selectedSong && enteredStart !== undefined && enteredEnd !== undefined
    ? isValidInterval(enteredStart, enteredEnd, selectedSong.duration)
    : false

  const chooseSection = (section: PracticeSection) => {
    setSelectedSectionId(section.id)
    setDraft(undefined)
    setStartText(formatTime(section.start))
    setEndText(formatTime(section.end))
    waveSurferRef.current?.setTime(section.start)
    const region = regionsRef.current?.getRegions().find((item) => item.id === section.id)
    region?.setOptions({ color: 'rgba(213, 84, 53, 0.27)' })
    void savePreference({ key: 'last-opened', songId: section.songId, sectionId: section.id, position: section.start })
  }

  useEffect(() => {
    sectionsRef.current = sections
    selectedSectionRef.current = selectedSectionId
    loopRef.current = loop
  }, [loop, sections, selectedSectionId])

  const refreshSongs = useCallback(async () => {
    const [nextSongs, preference] = await Promise.all([
      audioPracticeDb.songs.orderBy('createdAt').reverse().toArray(),
      audioPracticeDb.preferences.get('last-opened'),
    ])
    setSongs(nextSongs)
    const preferred = nextSongs.find((song) => song.id === preference?.songId)
    setSelectedSongId((current) => current && nextSongs.some((song) => song.id === current)
      ? current : preferred?.id ?? nextSongs[0]?.id)
    if (preference?.sectionId) setSelectedSectionId(preference.sectionId)
    if (preference?.position !== undefined) setPosition(preference.position)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(refreshSongs).catch(() => setError('無法讀取本機音源資料，請重新整理後再試。'))
  }, [refreshSongs])

  useEffect(() => {
    if (!selectedSongId) {
      return
    }
    let cancelled = false
    Promise.all([
      audioPracticeDb.sections.where('songId').equals(selectedSongId).sortBy('updatedAt'),
      audioPracticeDb.preferences.get('last-opened'),
    ]).then(([nextSections, preference]) => {
        if (cancelled) return
        setSections(nextSections)
        const activeId = preference?.songId === selectedSongId
          ? nextSections.find((section) => section.id === preference.sectionId)?.id
          : undefined
        setSelectedSectionId(activeId)
        const activeSection = nextSections.find((section) => section.id === activeId)
        setStartText(formatTime(activeSection?.start ?? 0))
        setEndText(formatTime(activeSection?.end ?? selectedSong?.duration ?? 0))
        setDraft(undefined)
      })
      .catch(() => setError('無法讀取段落資料。'))
    return () => { cancelled = true }
  }, [selectedSongId, selectedSong?.duration])

  useEffect(() => {
    const regions = regionsRef.current
    if (!regions || !waveSurferRef.current) return
    for (const section of sections.filter((item) => item.songId === selectedSongId)) {
      const existing = regions.getRegions().find((region) => region.id === section.id)
      if (existing) {
        existing.setOptions({ color: section.id === selectedSectionId ? 'rgba(213, 84, 53, 0.27)' : 'rgba(91, 121, 141, 0.22)' })
      } else {
        regions.addRegion({
          id: section.id,
          start: section.start,
          end: section.end,
          color: section.id === selectedSectionId ? 'rgba(213, 84, 53, 0.27)' : 'rgba(91, 121, 141, 0.22)',
          drag: true,
          resize: true,
        })
      }
    }
  }, [sections, selectedSectionId, selectedSongId])

  useEffect(() => {
    if (!selectedSongId || !selectedSong || !waveformRef.current) return
    let cancelled = false
    const audioUrl = URL.createObjectURL(selectedSong.audio)
    const regions = RegionsPlugin.create()
    const waveSurfer = WaveSurfer.create({
      container: waveformRef.current,
      height: 170,
      waveColor: '#c7b8a7',
      progressColor: '#d55435',
      cursorColor: '#171a21',
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      mediaControls: false,
      plugins: [regions],
    })
    waveSurferRef.current = waveSurfer
    playbackRateRef.current = selectedSong.playbackRate ?? 1
    waveSurfer.setPlaybackRate(selectedSong.playbackRate ?? 1, true)
    regionsRef.current = regions
    waveSurfer.on('ready', () => {
      if (cancelled) return
      waveSurfer.setPlaybackRate(playbackRateRef.current, true)
      for (const section of sections.filter((item) => item.songId === selectedSongId)) {
        regions.addRegion({
          id: section.id,
          start: section.start,
          end: section.end,
          color: section.id === selectedSectionId ? 'rgba(213, 84, 53, 0.27)' : 'rgba(91, 121, 141, 0.22)',
          drag: true,
          resize: true,
        })
      }
      const restore = audioPracticeDb.preferences.get('last-opened')
      void restore.then((preference) => {
        if (cancelled) return
        if (preference?.songId === selectedSongId && preference.position !== undefined) {
          waveSurfer.setTime(Math.min(preference.position, waveSurfer.getDuration()))
        }
      })
      regions.enableDragSelection({ color: 'rgba(213, 84, 53, 0.27)', drag: true, resize: true }, 3)
    })
    const onRegionCreated = (region: Region) => {
      if (sectionsRef.current.some((section) => section.id === region.id)) return
      activeRegionRef.current = region
      setDraft({ id: region.id, start: region.start, end: region.end })
      setSelectedSectionId(undefined)
      setStartText(formatTime(region.start))
      setEndText(formatTime(region.end))
    }
    regions.on('region-created', onRegionCreated)
    regions.on('region-clicked', (region) => {
      const saved = sectionsRef.current.find((section) => section.id === region.id)
      if (saved) chooseSection(saved)
    })
    regions.on('region-updated', (region) => {
      if (activeRegionRef.current?.id === region.id) {
        setDraft({ id: region.id, start: region.start, end: region.end })
        setStartText(formatTime(region.start))
        setEndText(formatTime(region.end))
      }
      const saved = sectionsRef.current.find((section) => section.id === region.id)
      if (saved && isValidInterval(region.start, region.end, selectedSong.duration)) {
        const updated = { ...saved, start: region.start, end: region.end, updatedAt: Date.now() }
        setSections((current) => current.map((item) => item.id === updated.id ? updated : item))
        void saveSection(updated).catch(() => setError('段落時間儲存失敗，請確認裝置儲存空間。'))
        setStartText(formatTime(region.start))
        setEndText(formatTime(region.end))
      }
    })
    waveSurfer.on('timeupdate', (time) => {
      setPosition(time)
      if (Date.now() - lastPreferenceWriteRef.current > 2000) {
        lastPreferenceWriteRef.current = Date.now()
        void savePreference({ key: 'last-opened', songId: selectedSongId, sectionId: selectedSectionRef.current, position: time })
          .catch(() => setError('播放位置無法儲存在本機。'))
      }
    })
    waveSurfer.on('audioprocess', (time) => {
      const activeSection = sectionsRef.current.find((section) => section.id === selectedSectionRef.current)
      if (loopRef.current && activeSection && time >= activeSection.end) {
        waveSurfer.setTime(activeSection.start)
      }
    })
    waveSurfer.on('play', () => setPlaying(true))
    waveSurfer.on('pause', () => {
      setPlaying(false)
      void savePreference({
        key: 'last-opened',
        songId: selectedSongId,
        sectionId: selectedSectionRef.current,
        position: waveSurfer.getCurrentTime(),
      }).catch(() => setError('播放位置無法儲存在本機。'))
    })
    waveSurfer.on('finish', () => setPlaying(false))
    waveSurfer.on('error', () => setError('無法解碼或播放此音檔。請確認它是瀏覽器支援的 MP3、M4A 或 WAV。'))
    void waveSurfer.load(audioUrl).catch(() => {
      if (!cancelled) setError('無法解碼此音檔。請確認檔案未損毀，且瀏覽器支援其編碼。')
    })
    return () => {
      cancelled = true
      waveSurfer.pause()
      waveSurfer.destroy()
      URL.revokeObjectURL(audioUrl)
      if (waveSurferRef.current === waveSurfer) waveSurferRef.current = undefined
    }
    // Recreate the waveform when the song changes; section and preference changes are read through explicit actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSongId])

  useEffect(() => () => waveSurferRef.current?.pause(), [])

  const changePlaybackRate = (rate: number) => {
    if (!selectedSong) return
    playbackRateRef.current = rate
    waveSurferRef.current?.setPlaybackRate(rate, true)
    setSongs((current) => current.map((song) => song.id === selectedSong.id
      ? { ...song, playbackRate: rate }
      : song))
    void audioPracticeDb.songs.update(selectedSong.id, { playbackRate: rate })
      .catch(() => setError('播放速度無法儲存在本機，重新開啟後可能恢復原本設定。'))
  }

  const importFile = async (file?: File) => {
    if (!file) return
    setError(undefined)
    if (!isSupportedAudio(file)) {
      setError('請選擇瀏覽器支援的 MP3、M4A 或 WAV 檔案。')
      return
    }
    setBusy(true)
    try {
      const context = new AudioContext()
      let duration: number
      try {
        duration = (await context.decodeAudioData(await file.arrayBuffer())).duration
      } finally {
        await context.close()
      }
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('decode')
      const song: PracticeSong = {
        id: newId(),
        title: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        audio: file.slice(0, file.size, file.type || 'application/octet-stream'),
        duration,
        createdAt: Date.now(),
      }
      await addSong(song)
      setSongs((current) => [song, ...current])
      setSelectedSongId(song.id)
      setSelectedSectionId(undefined)
      setPosition(0)
      try {
        await savePreference({ key: 'last-opened', songId: song.id, position: 0 })
      } catch {
        setError('音源已儲存，但無法儲存最近使用的設定。')
      }
    } catch {
      setError('音檔無法解碼或無法儲存。請確認格式受支援，並檢查裝置可用空間。')
    } finally {
      setBusy(false)
    }
  }

  const saveDraft = async () => {
    if (!selectedSong || !draft || !isValidInterval(draft.start, draft.end, selectedSong.duration)) return
    const section: PracticeSection = {
      id: draft.id,
      songId: selectedSong.id,
      name: sectionName.trim() || `段落 ${sections.length + 1}`,
      start: draft.start,
      end: draft.end,
      updatedAt: Date.now(),
    }
    try {
      await saveSection(section)
      setSections((current) => [...current, section])
      setDraft(undefined)
      setSectionName('')
      activeRegionRef.current?.setOptions({ color: 'rgba(213, 84, 53, 0.27)' })
      activeRegionRef.current = undefined
      setSelectedSectionId(section.id)
      await savePreference({ key: 'last-opened', songId: selectedSong.id, sectionId: section.id, position: section.start })
    } catch {
      setError('段落儲存失敗，請確認裝置儲存空間。')
    }
  }

  const updateTime = (side: 'start' | 'end', value: string) => {
    if (side === 'start') setStartText(value)
    else setEndText(value)
    if (!selectedSong || !activeInterval) return
    const parsed = parseTime(value)
    if (parsed === undefined) return
    const next = { ...activeInterval, [side]: parsed }
    if (!isValidInterval(next.start, next.end, selectedSong.duration)) return
    const regionId = draft?.id ?? selectedSection?.id
    regionsRef.current?.getRegions().find((region) => region.id === regionId)?.setOptions(next)
    if (draft) setDraft({ ...draft, ...next })
    if (selectedSection) {
      const updated = { ...selectedSection, ...next, updatedAt: Date.now() }
      setSections((current) => current.map((section) => section.id === updated.id ? updated : section))
      void saveSection(updated).catch(() => setError('段落時間儲存失敗。'))
    }
  }

  const removeSelectedSection = async () => {
    if (!selectedSection || !window.confirm(`確定刪除「${selectedSection.name}」？`)) return
    try {
      await deleteSection(selectedSection.id)
      regionsRef.current?.getRegions().find((region) => region.id === selectedSection.id)?.remove()
      setSections((current) => current.filter((section) => section.id !== selectedSection.id))
      setSelectedSectionId(undefined)
      setStartText('00:00.00')
      setEndText(formatTime(selectedSong?.duration ?? 0))
    } catch {
      setError('段落刪除失敗。')
    }
  }

  const removeSong = async (song: PracticeSong) => {
    if (!window.confirm(`確定刪除「${song.title}」與其中的所有段落？`)) return
    try {
      waveSurferRef.current?.pause()
      await deleteSong(song.id)
      const next = songs.filter((item) => item.id !== song.id)
      setSongs(next)
      if (song.id === selectedSongId) {
        setSelectedSongId(next[0]?.id)
        setSelectedSectionId(undefined)
      }
    } catch {
      setError('音源刪除失敗。')
    }
  }

  const rename = async (kind: 'song' | 'section', value: string) => {
    const title = value.trim()
    if (!title) return
    try {
      if (kind === 'song' && selectedSong) {
        const updated = { ...selectedSong, title }
        await audioPracticeDb.songs.put(updated)
        setSongs((current) => current.map((song) => song.id === updated.id ? updated : song))
      } else if (kind === 'section' && selectedSection) {
        const updated = { ...selectedSection, name: title, updatedAt: Date.now() }
        await saveSection(updated)
        setSections((current) => current.map((section) => section.id === updated.id ? updated : section))
      }
      setRenameSong(false)
      setRenameSection(false)
    } catch {
      setError('名稱儲存失敗。')
    }
  }

  return (
    <main className="mx-auto min-h-screen w-[min(1440px,calc(100%_-_32px))] pt-[max(20px,env(safe-area-inset-top))] pb-[max(32px,env(safe-area-inset-bottom))] max-[760px]:w-[min(1440px,calc(100%_-_20px))] max-[760px]:pt-[18px]">
      <header className="px-0 pt-[6px] pb-[26px] max-[760px]:pb-[18px]">
        <button className="mb-[22px] border-0 bg-transparent p-0 text-[.9rem] font-bold text-accent-dark hover:text-accent" onClick={onHome}>← 所有工具</button>
        <p className="mb-[10px] text-[.78rem] font-bold tracking-[.18em] text-accent">LISTEN · REPEAT · PRACTICE</p>
        <h1 className="mb-[10px] text-[clamp(2.8rem,7vw,5.4rem)] leading-[.96] tracking-[-.06em] text-[#171a21]">音源練習器</h1>
        <p className="m-0 text-[#5e6065]">匯入自己的音源，選取段落並循環練習。</p>
      </header>
      {error && <p className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#e5b2a8] bg-[#fff8f4] px-4 py-3 text-[#a12e22]" role="alert">{error}<button className="border-0 bg-transparent text-[1.3rem] text-inherit" aria-label="關閉錯誤訊息" onClick={() => setError(undefined)}>×</button></p>}
      <section className="grid grid-cols-[minmax(230px,300px)_minmax(0,1fr)] items-start gap-5 max-[760px]:grid-cols-1 max-[760px]:gap-3" aria-label="音源練習器">
        <aside className="min-w-0 rounded-[20px] border border-border bg-white/[.68] p-5 shadow-[0_15px_45px_rgba(62,50,37,0.07)] max-[760px]:p-[14px]">
          <div className="mb-[14px] flex items-center justify-between"><h2 className="m-0 text-ink">我的音源</h2><span className="text-[.82rem] text-[#8b8276]">{songs.length}</span></div>
          <label className="grid min-h-12 cursor-pointer place-items-center rounded-xl border border-accent bg-accent font-extrabold text-white">
            <input className="absolute size-px overflow-hidden [clip:rect(0,0,0,0)]" type="file" accept="audio/mpeg,audio/mp4,audio/wav,.mp3,.m4a,.wav" disabled={busy} onChange={(event) => { void importFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
            {busy ? '正在讀取音檔…' : '+ 匯入音檔'}
          </label>
          <p className="my-[10px] mb-[18px] text-xs text-muted">音檔只會儲存在這台裝置上。</p>
          <div className="grid gap-2">
            {songs.map((song) => (
              <div key={song.id} className={`grid grid-cols-[minmax(0,1fr)_34px] items-center gap-1 rounded-xl border p-[5px] ${song.id === selectedSongId ? 'border-[#e4b6a8] bg-[#fff8f4]' : 'border-transparent'}`}>
                <button className="grid min-w-0 gap-[5px] border-0 bg-transparent p-2 text-left text-[#33353a]" onClick={() => {
                  setSelectedSongId(song.id)
                  setSelectedSectionId(undefined)
                  setPosition(0)
                  void savePreference({ key: 'last-opened', songId: song.id, position: 0 })
                    .catch(() => setError('選取的音源無法儲存至本機設定。'))
                }}>
                  <strong className="overflow-hidden text-ellipsis whitespace-nowrap">{song.title}</strong><small className="text-[.72rem] text-[#8b8276]">{formatTime(song.duration)}</small>
                </button>
                <button className="size-8 rounded-full border-0 bg-transparent text-[1.2rem] text-muted hover:bg-[#f1ebe2] hover:text-[#a12e22]" aria-label={`刪除 ${song.title}`} onClick={() => void removeSong(song)}>×</button>
              </div>
            ))}
            {songs.length === 0 && <p className="text-[.82rem] leading-[1.55] text-muted">匯入 MP3、M4A 或 WAV，開始建立練習清單。</p>}
          </div>
        </aside>
        <section className="min-h-[500px] min-w-0 rounded-[20px] border border-border bg-white/[.68] p-6 shadow-[0_15px_45px_rgba(62,50,37,0.07)] max-[760px]:min-h-[460px] max-[760px]:p-4 max-[760px]:px-3" aria-label="音源播放器">
          {!selectedSong ? <div className="grid min-h-[450px] content-center justify-items-center text-center"><span className="text-5xl text-accent" aria-hidden="true">♫</span><h2 className="mt-3 mb-1 text-xl">選擇一段音源開始練習</h2><p className="text-muted">你匯入的音檔會留在這台裝置。</p></div> : <>
            <div className="flex items-center justify-between gap-4">
              <div>{renameSong ? <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void rename('song', String(new FormData(event.currentTarget).get('title') ?? '')) }}><input className="h-[42px] min-w-0 rounded-[9px] border border-[#cfc6b9] bg-[#fffdf9] px-[10px]" autoFocus name="title" defaultValue={selectedSong.title} aria-label="音源名稱" /><button className="rounded-[9px] border-0 bg-accent px-3 text-white">儲存</button></form> : <><h2 className="m-0 break-words text-[1.35rem]">{selectedSong.title}</h2><small className="mt-[5px] block text-[#8b8276]">{selectedSong.fileName}</small></>}</div>
              <button className="shrink-0 border-0 bg-transparent text-[.82rem] font-bold text-accent-dark underline underline-offset-[3px]" onClick={() => setRenameSong((value) => !value)}>{renameSong ? '取消' : '重新命名'}</button>
            </div>
            <div ref={waveformRef} className="my-6 mb-3 min-h-[170px] w-full touch-pan-y overflow-hidden rounded-xl border border-[#e6ded3] bg-[#fffdf9] max-[760px]:my-[18px] max-[760px]:mb-3 max-[760px]:min-h-[150px]" aria-label="音源波形；拖曳建立 A–B 段落" />
            <div className="grid grid-cols-[48px_auto_minmax(80px,1fr)_auto_auto] items-center gap-3 max-[760px]:grid-cols-[44px_auto_minmax(40px,1fr)_auto] max-[760px]:gap-2">
              <button className="min-h-11 rounded-[11px] border border-[#d8d0c4] bg-accent text-[1.1rem] text-white" aria-label={playing ? '暫停' : '播放'} onClick={() => {
                const waveSurfer = waveSurferRef.current
                if (!waveSurfer || !enteredIntervalValid) return
                if (playing) waveSurfer.pause()
                else {
                  if (loop && selectedSection) waveSurfer.setTime(selectedSection.start)
                  void waveSurfer.play()
                }
              }}>{playing ? 'Ⅱ' : '▶'}</button>
              <span className="text-[.78rem] tabular-nums text-muted">{formatTime(position)}</span>
              <input className="w-full accent-accent" type="range" min="0" max={selectedSong.duration} step="0.01" value={Math.min(position, selectedSong.duration)} aria-label="播放位置" onChange={(event) => waveSurferRef.current?.setTime(Number(event.target.value))} />
              <span className="text-[.78rem] tabular-nums text-muted">{formatTime(selectedSong.duration)}</span>
              <button className={`min-h-11 whitespace-nowrap rounded-[11px] border px-[10px] max-[760px]:col-span-full max-[760px]:min-h-[38px] ${loop ? 'border-accent text-accent-dark' : 'border-[#d8d0c4] text-[#33353a]'}`} aria-pressed={loop} onClick={() => setLoop((value) => !value)}>↻ <span className="text-[.78rem]">循環</span></button>
            </div>
            <PlaybackSpeedControl rate={playbackRate} onChange={changePlaybackRate} />
            <div className="mt-7 border-t border-border pt-5">
              <div className="mb-[14px] flex items-center justify-between gap-4"><div><h3 className="m-0 text-base">練習段落</h3><p className="mt-[5px] mb-0 text-[.78rem] text-muted">在波形上拖曳，或編輯 A、B 時間。</p></div>{selectedSection && <button className="shrink-0 border-0 bg-transparent text-[.82rem] font-bold text-accent-dark underline underline-offset-[3px]" onClick={() => setRenameSection((value) => !value)}>{renameSection ? '取消' : '重新命名'}</button>}</div>
              <div className="flex flex-wrap items-end gap-[10px]">
                <label className="grid gap-[5px] text-[.72rem] font-bold text-[#655f58]">A 起點<input className="h-[42px] w-28 min-w-0 rounded-[9px] border border-[#cfc6b9] bg-[#fffdf9] px-[10px] tabular-nums aria-invalid:border-[#a12e22]" aria-label="A 起點" value={startText} aria-invalid={!enteredIntervalValid} onChange={(event) => updateTime('start', event.target.value)} onBlur={() => activeInterval && setStartText(formatTime(activeInterval.start))} /></label>
                <span aria-hidden="true">→</span>
                <label className="grid gap-[5px] text-[.72rem] font-bold text-[#655f58]">B 終點<input className="h-[42px] w-28 min-w-0 rounded-[9px] border border-[#cfc6b9] bg-[#fffdf9] px-[10px] tabular-nums aria-invalid:border-[#a12e22]" aria-label="B 終點" value={endText} aria-invalid={!enteredIntervalValid} onChange={(event) => updateTime('end', event.target.value)} onBlur={() => activeInterval && setEndText(formatTime(activeInterval.end))} /></label>
                {draft && <><input className="min-w-0 h-[42px] flex-[1_1_120px] rounded-[9px] border border-[#cfc6b9] bg-[#fffdf9] px-[10px]" aria-label="新段落名稱" placeholder={`段落 ${sections.length + 1}`} value={sectionName} onChange={(event) => setSectionName(event.target.value)} /><button className="min-h-[42px] rounded-[9px] border-0 bg-accent px-[14px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!enteredIntervalValid} onClick={() => void saveDraft()}>儲存段落</button></>}
                {selectedSection && renameSection && <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void rename('section', String(new FormData(event.currentTarget).get('name') ?? '')) }}><input className="h-[42px] min-w-0 rounded-[9px] border border-[#cfc6b9] bg-[#fffdf9] px-[10px]" autoFocus name="name" defaultValue={selectedSection.name} aria-label="段落名稱" /><button className="rounded-[9px] border-0 bg-accent px-3 text-white">儲存</button></form>}
                {selectedSection && <button className="min-h-10 border-0 bg-transparent text-[.8rem] text-[#a12e22]" onClick={() => void removeSelectedSection()}>刪除段落</button>}
              </div>
              {!enteredIntervalValid && <p className="text-[.78rem] text-[#a12e22]" role="alert">請輸入 0 ≤ A &lt; B ≤ 音源長度的有效時間（秒數或 mm:ss.xx）。</p>}
              <div className="mt-4 flex flex-wrap gap-2" aria-label="已儲存段落">
                {sections.map((section) => <button key={section.id} className={`grid min-h-[54px] justify-items-start gap-1 rounded-[11px] border px-3 py-2 text-left ${section.id === selectedSectionId ? 'border-accent bg-[#fff5f0]' : 'border-border bg-[#fffdf9] text-[#33353a]'}`} onClick={() => chooseSection(section)}><strong>{section.name}</strong><span className="text-[.72rem] tabular-nums text-muted">{formatTime(section.start)}–{formatTime(section.end)}</span></button>)}
                {sections.length === 0 && !draft && <p className="text-[.82rem] leading-[1.55] text-muted">拖曳波形框選段落，儲存後即可快速選取。</p>}
              </div>
            </div>
          </>}
        </section>
      </section>
    </main>
  )
}

function PlaybackSpeedControl({ rate, onChange }: { rate: number; onChange: (rate: number) => void }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-[#fffdf9] px-3 py-2">
      <label htmlFor="audio-playback-rate" className="text-[.82rem] font-bold text-[#655f58]">播放速度</label>
      <output htmlFor="audio-playback-rate" className="min-w-[4.5rem] text-[.82rem] tabular-nums text-accent-dark">{rate.toFixed(2)} 倍</output>
      <input
        id="audio-playback-rate"
        className="min-h-11 min-w-[100px] flex-1 accent-accent"
        type="range"
        min="0.5"
        max="1"
        step="0.05"
        value={rate}
        aria-valuetext={`${rate.toFixed(2)} 倍，維持原本音高`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <button
        className="min-h-11 rounded-[9px] border border-[#d8d0c4] px-3 text-[.82rem] text-[#33353a] disabled:opacity-50"
        disabled={rate === 1}
        onClick={() => onChange(1)}
      >
        恢復原速
      </button>
      <p className="m-0 w-full text-xs text-muted">變速時維持原本音高，時間與段落位置以原曲為準。</p>
    </div>
  )
}
