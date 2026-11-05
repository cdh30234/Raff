/**
 * The small Home cards: date, weather and apps.
 * Date is local and redraws at midnight; weather and apps come from main
 * (home.ts), cached there, fetched when the page opens.
 */
import { useEffect, useState } from 'react'
import { edge } from '../../lib/edge'
import { PRAYER_CITIES } from '../../../shared/tools'
import type { HomeApp, HomeWeather } from '../../../electron/main/home'
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

/**
 * A translated sentence with the temperature kept left-to-right inside Arabic
 * text ("25°", not "°25"): the sentence is split around the value, which goes
 * in a <bdi dir="ltr">, so every language keeps its own word order.
 */
const MARK = '\u0000'
function withTemp(text: string, value: string) {
  const [before, after] = text.split(MARK)
  return (
    <>
      {before}
      <bdi dir="ltr">{value}</bdi>
      {after}
    </>
  )
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

function WeatherIcon({ kind, day }: { kind: HomeWeather['kind']; day: boolean }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const cloud = <path {...p} d="M7.5 18.5h9a3.8 3.8 0 0 0 .5-7.6A5.2 5.2 0 0 0 7 9.6a4.5 4.5 0 0 0 .5 8.9z" />
  const sun = day
    ? <g {...p}><circle cx="12" cy="12" r="4" /><path d="M12 3v1.6M12 19.4V21M3 12h1.6M19.4 12H21M5.6 5.6l1.1 1.1M17.3 17.3l1.1 1.1M5.6 18.4l1.1-1.1M17.3 6.7l1.1-1.1" /></g>
    : <path {...p} d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      {kind === 'clear' || kind === 'mostlyClear' ? sun : cloud}
      {(kind === 'rain' || kind === 'showers' || kind === 'drizzle') && <path {...p} d="M9 20.5l-.8 1.6M13 20.5l-.8 1.6M17 20.5l-.8 1.6" />}
      {kind === 'thunder' && <path {...p} d="M12.5 18.5 11 21.5h2.2L12 24" />}
      {kind === 'snow' && <path {...p} d="M9 21.2h.01M13 21.2h.01M17 21.2h.01" />}
    </svg>
  )
}

export function WeatherCard({ cityId, t, lang }: { cityId: string; t: T; lang: string }) {
  const [w, setW] = useState<HomeWeather | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void edge.getWeather(cityId).then((x) => alive && setW(x))
    return () => {
      alive = false
    }
  }, [cityId])
  const city = PRAYER_CITIES.find((c) => c.id === cityId)
  const cityName = city ? (lang === 'ar' ? city.ar : city.en) : ''
  const deg = (n: number) => `${new Intl.NumberFormat(lang).format(n)}°`
  if (w === undefined) return <div className="home-card weather-card is-loading" aria-busy="true" />
  if (!w) return <div className="home-card weather-card is-empty"><span>{t('tools.weather.unavailable')}</span></div>
  return (
    <div className="home-card weather-card">
      <p className="weather-text">
        <strong>{withTemp(t('tools.weather.now', { temp: MARK, city: cityName }), deg(w.temp))}</strong>{' '}
        <span>{withTemp(t('tools.weather.feels', { temp: MARK }), deg(w.feels))}</span>{' '}
        <strong>{t(`tools.weather.codes.${w.kind}`)}</strong>
      </p>
      <span className="weather-icon"><WeatherIcon kind={w.kind} day={w.isDay} /></span>
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
