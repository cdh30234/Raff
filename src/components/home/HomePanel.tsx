/**
 * Raff's Home page — the shelf's one page for everything that is not the
 * clipboard: Timer, Music, Apps, Prayer times (with the date) and Tasks.
 *
 * A lazily loaded chunk (Panel.tsx), mounted only while shown in an open shelf;
 * while mounted it follows the music player (music.ts) and nothing else runs.
 * Top dock: one row of cards. Side docks: a column that scrolls.
 * The timer picker and the prayer settings open in place of the cards.
 */
import { useState } from 'react'
import { useTranslation } from '../../i18n'
import { useTools } from '../tools/useTools'
import { TasksTool } from '../tools/TasksTool'
import { PrayerTool } from '../tools/PrayerTool'
import { TimerCard, TimerPicker } from './TimerCard'
import { MusicCard } from './MusicCard'
import { AppsCard, DateCard, PrayerCard } from './InfoCards'
import '../../styles/tools.css'
import '../../styles/home.css'

type View = 'cards' | 'timer' | 'prayer'

export default function HomePanel({ isHorizontal }: { isHorizontal: boolean }) {
  const { t, resolvedLang } = useTranslation()
  const { state, update } = useTools()
  const [view, setView] = useState<View>('cards')
  const cls = `home${isHorizontal ? ' is-horizontal' : ''}`

  if (!state) return <div className={cls} aria-busy="true" />

  if (view === 'timer') {
    return (
      <div className={cls}>
        <TimerPicker timer={state.timer} update={update} onDone={() => setView('cards')} t={t} lang={resolvedLang} />
      </div>
    )
  }
  if (view === 'prayer') {
    return (
      <div className={`${cls} is-sheet`}>
        <div className="home-sheet tools">
          <PrayerTool state={state} update={update} t={t} lang={resolvedLang} />
          <button type="button" className="home-pill home-sheet-done" onClick={() => setView('cards')}>{t('tools.done')}</button>
        </div>
      </div>
    )
  }

  const timer = <TimerCard timer={state.timer} update={update} onPick={() => setView('timer')} t={t} lang={resolvedLang} />
  const music = <MusicCard t={t} />
  const prayer = <PrayerCard state={state} onSettings={() => setView('prayer')} t={t} lang={resolvedLang} />
  const tasks = (
    <div className="home-card tasks-card tools">
      <TasksTool tasks={state.tasks} update={update} t={t} lang={resolvedLang} />
    </div>
  )

  if (isHorizontal) {
    return (
      <div className={cls}>
        <div className="home-slot is-timer">{timer}</div>
        <div className="home-slot is-music">{music}</div>
        <div className="home-slot is-apps"><AppsCard columns={2} rows={3} t={t} /></div>
        <div className="home-slot is-prayer">{prayer}</div>
        <div className="home-slot is-tasks">{tasks}</div>
      </div>
    )
  }

  return (
    <div className={cls}>
      <div className="home-pair"><DateCard lang={resolvedLang} />{timer}</div>
      {music}
      {prayer}
      {tasks}
      <AppsCard columns={4} rows={2} t={t} />
    </div>
  )
}
