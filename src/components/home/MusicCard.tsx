/**
 * Now playing (Apple Music / Spotify): artwork as the card's backdrop, title
 * and artist, a progress bar to click and seek, and previous / play-pause /
 * next. Main follows the player only while this card is mounted (music.ts);
 * the bar advances locally between its once-a-second updates.
 */
import { useEffect, useState, type MouseEvent } from 'react'
import { edge } from '../../lib/edge'
import type { MusicState } from '../../../electron/main/music'
import { useTicker } from '../tools/useTools'

type T = (key: string, params?: Record<string, string | number>) => string

const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function MusicCard({ t }: { t: T }) {
  const [m, setM] = useState<MusicState | null>(null)

  useEffect(() => {
    let alive = true
    void edge.watchMusic(true).then((s) => alive && setM(s))
    const off = edge.onMusic((s) => setM(s))
    return () => {
      alive = false
      off()
      void edge.watchMusic(false)
    }
  }, [])

  const now = useTicker(!!m?.playing, 500)
  if (!m || !m.player) {
    return (
      <div className="home-card music-card is-empty">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18V6l11-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" />
        </svg>
        <strong>{t('tools.music.nothing')}</strong>
        <span>{m?.denied ? t('tools.music.permission', { player: m.denied === 'Music' ? 'Apple Music' : 'Spotify' }) : t('tools.music.openPlayer')}</span>
      </div>
    )
  }

  const position = Math.min(m.duration || Infinity, m.position + (m.playing ? (now - m.at) / 1000 : 0))
  const progress = m.duration ? position / m.duration : 0
  const seek = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    void edge.musicCommand('seek', Math.round(((e.clientX - r.left) / r.width) * m.duration))
  }

  return (
    <div className="home-card music-card" dir="ltr">
      {m.artwork && <div className="music-backdrop" style={{ backgroundImage: `url("${m.artwork}")` }} aria-hidden="true" />}
      <div className="music-top">
        {m.artwork ? <img className="music-art" src={m.artwork} alt="" /> : <span className="music-art is-blank" />}
        <div className="music-meta">
          <strong dir="auto">{m.artist || m.player}</strong>
          <span dir="auto">{m.album}</span>
        </div>
      </div>
      <div className="music-title" dir="auto">{m.title}</div>
      <div className="music-bar" onClick={seek} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="music-times">
        <span>{clock(position)}</span>
        <span>-{clock(Math.max(0, m.duration - position))}</span>
      </div>
      <div className="music-controls">
        <button type="button" aria-label={t('tools.music.previous')} onClick={() => void edge.musicCommand('previous')}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M11.5 12 20 6v12zM3.5 12 12 6v12z" /></svg>
        </button>
        <button type="button" className="is-main" aria-label={m.playing ? t('tools.music.pause') : t('tools.music.play')} onClick={() => void edge.musicCommand('playpause')}>
          {m.playing ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>
          )}
        </button>
        <button type="button" aria-label={t('tools.music.next')} onClick={() => void edge.musicCommand('next')}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12.5 12 4 18V6zm8 0L12 18V6z" /></svg>
        </button>
      </div>
    </div>
  )
}
