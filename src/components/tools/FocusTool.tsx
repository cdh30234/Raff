/**
 * Focus timer (Pomodoro): a ring with the time left, the round dots, and
 * Start / Pause / Reset / Skip. Main keeps the real end time and sends the
 * notification, so the timer keeps going (and announces itself) with the
 * shelf closed; this view only redraws once a second while it is visible.
 */
import { advanceFocus, phaseMinutes, type FocusState, type ToolsData } from '../../../shared/tools'
import { formatTimer, useTicker } from './useTools'

const FOCUS_PRESETS = [15, 25, 45, 60]

interface Props {
  focus: FocusState
  update: (patch: Partial<ToolsData>) => void
  t: (key: string, params?: Record<string, string | number>) => string
  lang: string
}

export function FocusTool({ focus, update, t, lang }: Props) {
  const now = useTicker(focus.status === 'running', 1000)
  const totalMs = phaseMinutes(focus) * 60_000
  const leftMs =
    focus.status === 'running' && focus.endsAt ? Math.max(0, focus.endsAt - now)
    : focus.status === 'paused' && focus.remainingMs != null ? focus.remainingMs
    : totalMs
  const progress = totalMs ? 1 - leftMs / totalMs : 0

  const set = (next: FocusState) => update({ focus: next })
  const start = () => set({ ...focus, status: 'running', endsAt: Date.now() + (focus.status === 'paused' && focus.remainingMs != null ? focus.remainingMs : totalMs), remainingMs: undefined })
  const pause = () => set({ ...focus, status: 'paused', remainingMs: focus.endsAt ? Math.max(0, focus.endsAt - Date.now()) : totalMs, endsAt: undefined })
  const reset = () => set({ ...focus, status: 'idle', endsAt: undefined, remainingMs: undefined })
  // Skipping a focus round does not count it as done.
  const skip = () =>
    set(focus.phase === 'focus'
      ? { ...focus, phase: 'short', status: 'idle', endsAt: undefined, remainingMs: undefined }
      : advanceFocus(focus))
  const cyclePreset = () => {
    if (focus.status !== 'idle' || focus.phase !== 'focus') return
    const i = FOCUS_PRESETS.indexOf(focus.focusMin)
    set({ ...focus, focusMin: FOCUS_PRESETS[(i + 1) % FOCUS_PRESETS.length] })
  }

  const R = 44
  const C = 2 * Math.PI * R
  return (
    <div className={`focus-tool phase-${focus.phase}`}>
      <div className="focus-ring" dir="ltr">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="focus-ring-track" cx="50" cy="50" r={R} />
          <circle className="focus-ring-fill" cx="50" cy="50" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
        </svg>
        <div className="focus-ring-text">
          <span className="focus-time">{formatTimer(leftMs, lang)}</span>
          <span className="focus-phase">{t(`tools.focus.phases.${focus.phase}`)}</span>
        </div>
      </div>

      <div className="focus-side">
        <div className="focus-rounds" aria-label={t('tools.focus.roundOf', { n: Math.min(focus.round + 1, focus.rounds), total: focus.rounds })}>
          {Array.from({ length: focus.rounds }, (_, i) => (
            <span key={i} className={`focus-dot${i < focus.round ? ' is-done' : ''}${i === focus.round && focus.phase === 'focus' ? ' is-current' : ''}`} />
          ))}
        </div>
        <div className="focus-meta">
          <button type="button" className="tools-chip" onClick={cyclePreset} disabled={focus.status !== 'idle' || focus.phase !== 'focus'}>
            {t('tools.focus.minutes', { n: new Intl.NumberFormat(lang).format(focus.focusMin) })}
          </button>
          <span className="tools-muted">{t('tools.focus.today', { count: focus.doneToday })}</span>
        </div>
        <div className="focus-actions">
          {focus.status === 'running' ? (
            <button type="button" className="tools-btn is-primary" onClick={pause}>{t('tools.focus.pause')}</button>
          ) : (
            <button type="button" className="tools-btn is-primary" onClick={start}>
              {focus.status === 'paused' ? t('tools.focus.resume') : t('tools.focus.start')}
            </button>
          )}
          <button type="button" className="tools-btn" onClick={reset} disabled={focus.status === 'idle'}>{t('tools.focus.reset')}</button>
          <button type="button" className="tools-btn" onClick={skip}>{t('tools.focus.skip')}</button>
        </div>
      </div>
    </div>
  )
}
