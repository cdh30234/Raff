import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan'
import { advanceFocus, cityForTimeZone, defaultFocus, PRAYER_CITIES, PRAYER_METHODS } from '../shared/tools'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

describe('focus timer rounds', () => {
  const now = new Date('2026-11-05T10:00:00').getTime()

  it('a finished focus round counts and leads to a short break', () => {
    const next = advanceFocus({ ...defaultFocus(now), status: 'running', endsAt: now }, now)
    expect(next).toMatchObject({ phase: 'short', status: 'idle', round: 1, doneToday: 1 })
    expect(next.endsAt).toBeUndefined()
  })

  it('the last round of the cycle leads to a long break, then a fresh cycle', () => {
    const longBreak = advanceFocus({ ...defaultFocus(now), round: 3 }, now)
    expect(longBreak).toMatchObject({ phase: 'long', round: 4 })
    expect(advanceFocus(longBreak, now)).toMatchObject({ phase: 'focus', round: 0 })
  })

  it('a short break goes back to focus and keeps the round', () => {
    expect(advanceFocus({ ...defaultFocus(now), phase: 'short', round: 2 }, now)).toMatchObject({ phase: 'focus', round: 2 })
  })

  it("today's count starts over on a new day", () => {
    const yesterday = { ...defaultFocus(now), doneToday: 5, doneDate: '2026-11-04' }
    expect(advanceFocus(yesterday, now).doneToday).toBe(1)
  })
})

describe('prayer times', () => {
  it('guesses the city from the Mac time zone, else Makkah', () => {
    expect(cityForTimeZone('Asia/Baghdad').id).toBe('baghdad')
    expect(cityForTimeZone('Africa/Cairo').method).toBe('Egyptian')
    expect(cityForTimeZone('Mars/Olympus').id).toBe('makkah')
    expect(cityForTimeZone(undefined).id).toBe('makkah')
  })

  it('every city uses a method the prayer library knows, with real coordinates', () => {
    const known = new Set(PRAYER_METHODS.map((m) => m.id))
    for (const c of PRAYER_CITIES) {
      expect(known.has(c.method), c.id).toBe(true)
      expect(typeof CalculationMethod[c.method], c.id).toBe('function')
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(90)
      expect(Math.abs(c.lon)).toBeLessThanOrEqual(180)
    }
    expect(new Set(PRAYER_CITIES.map((c) => c.id)).size).toBe(PRAYER_CITIES.length)
  })

  it('Baghdad on 5 Nov 2026: times in order, Dhuhr just after solar noon, Maghrib at sunset', () => {
    const pt = new PrayerTimes(new Coordinates(33.3152, 44.3661), new Date(2026, 10, 5), CalculationMethod.MuslimWorldLeague())
    const order = [pt.fajr, pt.sunrise, pt.dhuhr, pt.asr, pt.maghrib, pt.isha].map((d) => d.getTime())
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    // Solar noon in Baghdad that day is ~08:46 UTC; sunset ~14:07 UTC.
    const utcMin = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes()
    expect(Math.abs(utcMin(pt.dhuhr) - (8 * 60 + 47))).toBeLessThanOrEqual(3)
    expect(Math.abs(utcMin(pt.maghrib) - (14 * 60 + 7))).toBeLessThanOrEqual(3)
  })
})

describe('tools stay off the startup and clipboard paths', () => {
  it('the tools page is a lazy chunk, only imported dynamically', () => {
    expect(read('src/components/Panel.tsx')).toContain("const ToolsPanel = lazy(() => import('./tools/ToolsPanel'))")
    for (const file of ['src/components/Panel.tsx', 'src/components/Header.tsx', 'src/components/ToolsToggle.tsx', 'src/App.tsx', 'src/main.tsx']) {
      expect(read(file), file).not.toMatch(/^import [^\n]*tools\/(ToolsPanel|FocusTool|TasksTool|PrayerTool|Companion)/m)
    }
  })

  it('the page is unmounted whenever the shelf is closed', () => {
    expect(read('src/components/Panel.tsx')).toContain('{toolsOpen && open ? (')
  })

  it('main loads the prayer library on demand and keeps one timer, no polling interval', () => {
    const main = read('electron/main/tools.ts')
    expect(main).not.toMatch(/^import [^\n]*from 'adhan'/m)
    expect(main).toContain("import('adhan')")
    expect(main).not.toContain('setInterval')
    // The clipboard modules know nothing of the tools.
    for (const file of ['electron/clipboard/ClipboardWatcher.ts', 'electron/clipboard/formats.ts', 'electron/clipboard/osClipboard.ts']) {
      expect(read(file), file).not.toMatch(/from '[^']*(main\/tools|shared\/tools)'/)
    }
  })
})
