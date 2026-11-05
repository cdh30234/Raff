/**
 * The Timer card and its picker. Main owns the end time and the "done"
 * notification (tools.ts), so the countdown keeps going with the shelf closed;
 * this view redraws once a second only while it is visible and running.
 *
 * Progress runs as an orange line around the card's edge.
 */
import { useState } from 'react'
import type { TimerState, ToolsData } from '../../../shared/tools'
import { formatTimer, useTicker } from '../tools/useTools'
import { RulerPicker } from './RulerPicker'

type T = (key: string, params?: Record<string, string | number>) => string

function leftMs(timer: TimerState, now: number): number {
  if (timer.status === 'running' && timer.endsAt) return Math.max(0, timer.endsAt - now)
  if (timer.status === 'paused' && timer.remainingMs != null) return timer.remainingMs
  return timer.durationMin * 60_000
}

export function TimerCard({ timer, update, onPick, t, lang }: { timer: TimerState; update: (p: Partial<ToolsData>) => void; onPick: () => void; t: T; lang: string }) {
  const now = useTicker(timer.status === 'running', 1000)
  const total = timer.durationMin * 60_000
  const left = leftMs(timer, now)
  const progress = timer.status === 'idle' ? 0 : 1 - left / total
  const set = (next: TimerState) => update({ timer: next })
  const pause = () => set({ ...timer, status: 'paused', remainingMs: left, endsAt: undefined })
  const resume = () => set({ ...timer, status: 'running', endsAt: Date.now() + left, remainingMs: undefined })
  const cancel = () => set({ ...timer, status: 'idle', endsAt: undefined, remainingMs: undefined })

  return (
    <div className={`home-card timer-card is-${timer.status}`}>
      {timer.status !== 'idle' && (
        <svg className="timer-edge" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <rect x="1.5" y="1.5" width="97" height="97" rx="14" ry="14" pathLength={100} strokeDasharray={`${progress * 100} 100`} />
        </svg>
      )}
      <span className="home-card-label">{t('tools.timer.title')}</span>
      <button type="button" className="timer-time" onClick={timer.status === 'idle' ? onPick : undefined} title={timer.status === 'idle' ? t('tools.timer.pick') : undefined}>
        {formatTimer(left, lang)}
      </button>
      <div className="timer-buttons">
        {timer.status === 'idle' ? (
          <button type="button" className="home-pill is-accent" onClick={onPick}>{t('tools.timer.start')}</button>
        ) : (
          <>
            <button type="button" className="home-round is-accent" aria-label={timer.status === 'running' ? t('tools.timer.pause') : t('tools.timer.resume')} onClick={timer.status === 'running' ? pause : resume}>
              {timer.status === 'running' ? (
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>
              )}
            </button>
            <button type="button" className="home-round" aria-label={t('tools.timer.cancel')} onClick={cancel}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** The picker: ruler, the chosen time, a 25-minute shortcut, Start. */
export function TimerPicker({ timer, update, onDone, t, lang }: { timer: TimerState; update: (p: Partial<ToolsData>) => void; onDone: () => void; t: T; lang: string }) {
  const [minutes, setMinutes] = useState(timer.durationMin)
  const [key, setKey] = useState(0)
  const start = () => {
    update({ timer: { status: 'running', durationMin: minutes, endsAt: Date.now() + minutes * 60_000 } })
    onDone()
  }
  return (
    <div className="timer-picker">
      <RulerPicker key={key} value={minutes} onChange={setMinutes} label={t('tools.timer.pick')} lang={lang} />
      <div className="timer-picker-row">
        <span className="timer-picker-time">{formatTimer(minutes * 60_000, lang)}</span>
        <button
          type="button"
          className="home-pill"
          onClick={() => {
            setMinutes(25)
            setKey((k) => k + 1) // re-centre the ruler on 25
          }}
        >
          {t('tools.focus.minutes', { n: new Intl.NumberFormat(lang).format(25) })}
        </button>
        <div className="timer-picker-actions">
          <button type="button" className="home-pill" onClick={onDone}>{t('tools.timer.cancel')}</button>
          <button type="button" className="home-pill is-accent-fill" onClick={start}>{t('tools.timer.start')}</button>
        </div>
      </div>
    </div>
  )
}
