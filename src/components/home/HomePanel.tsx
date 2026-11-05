/**
 * Raff's Home page: Timer, Music, Apps, Date and Weather cards.
 *
 * A lazily loaded chunk (Panel.tsx), mounted only while shown in an open shelf;
 * while mounted it follows the music player (music.ts) and nothing else runs.
 * Top dock: one row of cards. Side docks: a compact grid that scrolls.
 */
import { useState } from 'react'
import { useTranslation } from '../../i18n'
import { useTools } from '../tools/useTools'
import { TimerCard, TimerPicker } from './TimerCard'
import { MusicCard } from './MusicCard'
import { AppsCard, DateCard, WeatherCard } from './InfoCards'
import '../../styles/home.css'

export default function HomePanel({ isHorizontal }: { isHorizontal: boolean }) {
  const { t, resolvedLang } = useTranslation()
  const { state, update } = useTools()
  const [picking, setPicking] = useState(false)

  if (!state) return <div className={`home${isHorizontal ? ' is-horizontal' : ''}`} aria-busy="true" />

  if (picking) {
    return (
      <div className={`home${isHorizontal ? ' is-horizontal' : ''}`}>
        <TimerPicker timer={state.timer} update={update} onDone={() => setPicking(false)} t={t} lang={resolvedLang} />
      </div>
    )
  }

  const timer = <TimerCard timer={state.timer} update={update} onPick={() => setPicking(true)} t={t} lang={resolvedLang} />
  const music = <MusicCard t={t} />
  const date = <DateCard lang={resolvedLang} />
  const weather = <WeatherCard cityId={state.prayer.cityId} t={t} lang={resolvedLang} />

  if (isHorizontal) {
    return (
      <div className="home is-horizontal">
        <div className="home-slot is-timer">{timer}</div>
        <div className="home-slot is-music">{music}</div>
        <div className="home-slot is-apps"><AppsCard columns={2} rows={3} t={t} /></div>
        <div className="home-slot is-date">{date}</div>
        <div className="home-slot is-weather">{weather}</div>
      </div>
    )
  }

  return (
    <div className="home">
      <div className="home-pair">{date}{timer}</div>
      {music}
      {weather}
      <AppsCard columns={4} rows={2} t={t} />
    </div>
  )
}
