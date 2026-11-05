/**
 * Prayer times for the chosen city, calculated on this Mac (no network):
 * the next prayer with a countdown, today's times with the current one
 * marked, and a small settings sheet (city, method, Hanafi Asr, reminders).
 * Main does the maths (adhan) and sends the reminders.
 */
import { useState } from 'react'
import { PRAYER_CITIES, PRAYER_METHODS, type PrayerSettings, type ToolsData, type ToolsState } from '../../../shared/tools'
import { formatClock, formatDuration, useTicker } from './useTools'

interface Props {
  state: ToolsState
  update: (patch: Partial<ToolsData>) => void
  t: (key: string, params?: Record<string, string | number>) => string
  lang: string
}

export function PrayerTool({ state, update, t, lang }: Props) {
  const [showSettings, setShowSettings] = useState(false)
  const now = useTicker(true, 30_000)
  const ar = lang === 'ar'
  const p = state.prayer
  const set = (patch: Partial<PrayerSettings>) => update({ prayer: { ...p, ...patch } })
  const times = state.prayerToday?.times ?? []
  const next = state.prayerNext
  // The current prayer: the last one (sunrise excluded) whose time has come.
  const current = [...times].reverse().find((x) => x.id !== 'sunrise' && x.at <= now)?.id

  const settings = (
    <div className="prayer-settings">
      <label className="tools-field">
        <span>{t('tools.prayer.city')}</span>
        <select
          className="tools-select"
          value={p.cityId}
          onChange={(e) => {
            const city = PRAYER_CITIES.find((c) => c.id === e.target.value)
            if (city) set({ cityId: city.id, method: city.method })
          }}
        >
          {PRAYER_CITIES.map((c) => <option key={c.id} value={c.id}>{ar ? c.ar : c.en}</option>)}
        </select>
      </label>
      <label className="tools-field">
        <span>{t('tools.prayer.method')}</span>
        <select className="tools-select" value={p.method} onChange={(e) => set({ method: e.target.value as PrayerSettings['method'] })}>
          {PRAYER_METHODS.map((m) => <option key={m.id} value={m.id}>{ar ? m.ar : m.en}</option>)}
        </select>
      </label>
      <label className="tools-check">
        <input type="checkbox" checked={p.hanafiAsr} onChange={(e) => set({ hanafiAsr: e.target.checked })} />
        <span>{t('tools.prayer.hanafi')}</span>
      </label>
    </div>
  )

  return (
    <div className="prayer-tool">
      <div className="prayer-head">
        <div className="prayer-next">
          <span className="tools-muted">{t('tools.prayer.next')}</span>
          <strong>{next ? t(`tools.prayer.names.${next.id}`) : '—'}</strong>
          {next && (
            <span className="prayer-when">
              {formatClock(next.at, lang)} · {next.at - now < 60_000 ? t('tools.prayer.now') : t('tools.prayer.inTime', { time: formatDuration(next.at - now, lang) })}
            </span>
          )}
        </div>
        <button
          type="button"
          className={`tools-icon-btn${showSettings ? ' is-on' : ''}`}
          aria-pressed={showSettings}
          aria-label={t('tools.prayer.city')}
          title={t('tools.prayer.city')}
          onClick={() => setShowSettings(!showSettings)}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
            <circle cx="12" cy="10" r="2.4" />
          </svg>
        </button>
      </div>

      {showSettings ? settings : (
        <ul className="prayer-list">
          {times.map((x) => (
            <li key={x.id} className={`prayer-row${x.id === current ? ' is-current' : ''}${x.id === next?.id ? ' is-next' : ''}${x.id === 'sunrise' ? ' is-sunrise' : ''}`}>
              <span>{t(`tools.prayer.names.${x.id}`)}</span>
              <span className="prayer-time">{formatClock(x.at, lang)}</span>
            </li>
          ))}
        </ul>
      )}

      <label className="tools-check prayer-notify">
        <input type="checkbox" checked={p.notify} onChange={(e) => set({ notify: e.target.checked })} />
        <span>{t('tools.prayer.notify')}</span>
      </label>
    </div>
  )
}
