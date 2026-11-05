/**
 * The small Home cards: date, weather and apps.
 * Date is local and redraws at midnight; weather and apps come from main
 * (home.ts), cached there, fetched when the page opens.
 */
import { useEffect, useState } from 'react'
import { edge } from '../../lib/edge'
import { PRAYER_CITIES, type ToolsState } from '../../../shared/tools'
import { formatClock, formatDuration } from '../tools/useTools'
import type { HomeApp } from '../../../electron/main/home'
import { useTicker } from '../tools/useTools'

type T = (key: string, params?: Record<string, string | number>) => string

/**
 * The system's own variant of the interface language, for dates: Arabic in
 * Iraq says "تشرين الثاني", in Egypt "نوفمبر". Falls back to the plain code.
 */
function regionalLocale(lang: string): string {
  try {
    const match = (navigator.languages || []).find((l) => l.toLowerCase().startsWith(`${lang.toLowerCase()}-`))
    return match ?? lang
  } catch {
    return lang
  }
}

export function DateCard({ lang }: { lang: string }) {
  // Once a minute is plenty to roll over at midnight.
  const now = useTicker(true, 60_000)
  const d = new Date(now)
  const locale = regionalLocale(lang)
  const fmt = (o: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(locale, o).format(d)
    } catch {
      return new Intl.DateTimeFormat('en', o).format(d)
    }
  }
  return (
    <div className="home-card date-card">
      <div className="date-top">
        <span className="date-weekday">{fmt({ weekday: 'short' })}</span>
        <span className="date-month">{fmt({ month: 'short' })}</span>
      </div>
      <div className="date-day">{fmt({ day: 'numeric' })}</div>
    </div>
  )
}

export function AppsCard({ columns, rows, t }: { columns: number; rows: number; t: T }) {
  const [apps, setApps] = useState<HomeApp[] | null>(null)
  useEffect(() => {
    let alive = true
    void edge.getHomeApps().then((a) => alive && setApps(a))
    return () => {
      alive = false
    }
  }, [])
  const shown = (apps ?? []).slice(0, columns * rows)
  return (
    <div className="home-card apps-card" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }} aria-label={t('tools.apps.title')}>
      {apps && shown.length === 0 && <span className="apps-empty">{t('tools.apps.empty')}</span>}
      {shown.map((a) => (
        <button key={a.path} type="button" className="app-tile" title={a.name} aria-label={t('tools.apps.open', { app: a.name })} onClick={() => void edge.openHomeApp(a.path)}>
          {a.icon ? <img src={a.icon} alt="" draggable={false} /> : <span className="app-tile-blank">{a.name.slice(0, 1)}</span>}
        </button>
      ))}
    </div>
  )
}

/** "5:09" without AM/PM, for the narrow grid (the next prayer above keeps it). */
function shortClock(ms: number, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit' })
      .formatToParts(ms)
      .filter((p) => p.type !== 'dayPeriod')
      .map((p) => p.value)
      .join('')
      .trim()
  } catch {
    return formatClock(ms, lang)
  }
}

/**
 * Prayer times with the date: weekday and date on top, the next prayer with a
 * countdown, then today's five prayers. The pin opens the full settings
 * (city, method, reminders). Times come from main (tools.ts, adhan).
 */
export function PrayerCard({ state, onSettings, t, lang }: { state: ToolsState; onSettings: () => void; t: T; lang: string }) {
  const now = useTicker(true, 30_000)
  const locale = regionalLocale(lang)
  const city = PRAYER_CITIES.find((c) => c.id === state.prayer.cityId)
  const next = state.prayerNext
  const times = (state.prayerToday?.times ?? []).filter((x) => x.id !== 'sunrise')
  const current = [...times].reverse().find((x) => x.at <= now)?.id
  let date = ''
  try {
    date = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  } catch { /* keep empty */ }
  return (
    <div className="home-card prayer-card">
      <div className="prayer-card-top">
        <span className="prayer-card-date">{date}</span>
        <button type="button" className="prayer-card-place" onClick={onSettings} title={t('tools.prayer.city')}>
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" />
          </svg>
          {city ? (lang === 'ar' ? city.ar : city.en) : ''}
        </button>
      </div>
      {next && (
        <div className="prayer-card-next">
          <strong>{t(`tools.prayer.names.${next.id}`)}</strong>
          <span>{formatClock(next.at, lang)} · {next.at - now < 60_000 ? t('tools.prayer.now') : t('tools.prayer.inTime', { time: formatDuration(next.at - now, lang) })}</span>
        </div>
      )}
      <ul className="prayer-card-times">
        {times.map((x) => (
          <li key={x.id} className={`${x.id === current ? 'is-current' : ''}${x.id === next?.id ? ' is-next' : ''}`}>
            <span>{t(`tools.prayer.names.${x.id}`)}</span>
            <b>{shortClock(x.at, lang)}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}
