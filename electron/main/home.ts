/**
 * Data for the Home page: weather and the apps card. Everything is read when
 * the page asks for it and cached; nothing runs while the shelf is closed.
 *
 * Weather: Open-Meteo (free, no key, no account), for the prayer city's
 * coordinates; cached 30 minutes. Only the city's latitude/longitude is sent.
 * Apps: the user's Dock apps (`defaults read com.apple.dock`), with icons.
 */
import { app, net, nativeImage, shell } from 'electron'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import { cityForTimeZone, PRAYER_CITIES } from '../../shared/tools'

export type WeatherKind = 'clear' | 'mostlyClear' | 'partlyCloudy' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'showers' | 'thunder'

export interface HomeWeather {
  cityId: string
  temp: number
  feels: number
  kind: WeatherKind
  isDay: boolean
  at: number
}

export interface HomeApp {
  name: string
  path: string
  /** PNG data URL, 64px. */
  icon: string
}

const WEATHER_TTL_MS = 30 * 60 * 1000
let weatherCache: HomeWeather | null = null
let weatherLoading: Promise<HomeWeather | null> | null = null

/** WMO weather code (Open-Meteo) -> one of our labels. */
export function weatherKind(code: number): WeatherKind {
  if (code === 0) return 'clear'
  if (code === 1) return 'mostlyClear'
  if (code === 2) return 'partlyCloudy'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if ((code >= 61 && code <= 67) || code === 66 || code === 67) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 80 && code <= 82) return 'showers'
  if (code >= 95) return 'thunder'
  return 'cloudy'
}

function getJson(url: string, timeoutMs: number): Promise<unknown> {
  return new Promise((done) => {
    try {
      const req = net.request({ url })
      req.setHeader('User-Agent', `Raff/${app.getVersion()}`)
      const timer = setTimeout(() => {
        try { req.abort() } catch { /* ignore */ }
        done(null)
      }, timeoutMs)
      req.on('response', (res) => {
        let body = ''
        res.on('data', (c) => { body += c })
        res.on('end', () => {
          clearTimeout(timer)
          try { done(res.statusCode === 200 ? JSON.parse(body) : null) } catch { done(null) }
        })
      })
      req.on('error', () => { clearTimeout(timer); done(null) })
      req.end()
    } catch {
      done(null)
    }
  })
}

/** Current weather for `cityId` (a prayer city), cached; null when offline. */
export function getWeather(cityId: string | undefined): Promise<HomeWeather | null> {
  const city = PRAYER_CITIES.find((c) => c.id === cityId) ?? cityForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  if (weatherCache && weatherCache.cityId === city.id && Date.now() - weatherCache.at < WEATHER_TTL_MS) return Promise.resolve(weatherCache)
  weatherLoading ??= getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,apparent_temperature,weather_code,is_day`,
    8000
  ).then((raw) => {
    weatherLoading = null
    const cur = (raw as { current?: Record<string, number> } | null)?.current
    if (!cur || typeof cur.temperature_2m !== 'number') return weatherCache
    weatherCache = {
      cityId: city.id,
      temp: Math.round(cur.temperature_2m),
      feels: Math.round(cur.apparent_temperature ?? cur.temperature_2m),
      kind: weatherKind(cur.weather_code ?? 3),
      isDay: cur.is_day !== 0,
      at: Date.now()
    }
    return weatherCache
  })
  return weatherLoading
}

let appsCache: { at: number; apps: HomeApp[] } | null = null
const APPS_TTL_MS = 10 * 60 * 1000

/** Paths of the Dock's apps, in Dock order. */
function dockAppPaths(): Promise<string[]> {
  return new Promise((done) => {
    execFile('/usr/bin/defaults', ['read', 'com.apple.dock', 'persistent-apps'], { timeout: 4000 }, (err, out) => {
      if (err) return done([])
      const paths = [...out.matchAll(/"_CFURLString" = "?(file:\/\/[^";]+)"?;/g)]
        .map((m) => {
          try {
            return decodeURIComponent(new URL(m[1]).pathname).replace(/\/$/, '')
          } catch {
            return ''
          }
        })
        .filter((p) => p.endsWith('.app') && existsSync(p))
      done(paths)
    })
  })
}

/** Up to `limit` Dock apps with 64px icons, cached ten minutes. */
export async function getHomeApps(limit = 12): Promise<HomeApp[]> {
  if (appsCache && Date.now() - appsCache.at < APPS_TTL_MS) return appsCache.apps.slice(0, limit)
  const paths = (await dockAppPaths()).slice(0, 24)
  const apps: HomeApp[] = []
  for (const path of paths) {
    try {
      const icon = await nativeImage.createThumbnailFromPath(path, { width: 64, height: 64 })
      apps.push({ name: basename(path, '.app'), path, icon: icon.isEmpty() ? '' : icon.toDataURL() })
    } catch {
      apps.push({ name: basename(path, '.app'), path, icon: '' })
    }
  }
  appsCache = { at: Date.now(), apps }
  return apps.slice(0, limit)
}

/** Open one of the listed apps (only paths the apps card offered). */
export async function openHomeApp(path: string): Promise<boolean> {
  const known = appsCache?.apps.some((a) => a.path === path)
  if (!known || !existsSync(path)) return false
  return (await shell.openPath(path)) === ''
}
