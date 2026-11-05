import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('electron', () => ({ app: { getVersion: () => '1.2.0', getPath: () => '/tmp' }, net: { request: vi.fn() }, nativeImage: {}, shell: {} }))

import { weatherKind } from '../electron/main/home'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

describe('weather codes (WMO, Open-Meteo)', () => {
  it('maps every group to a label', () => {
    expect(weatherKind(0)).toBe('clear')
    expect(weatherKind(1)).toBe('mostlyClear')
    expect(weatherKind(2)).toBe('partlyCloudy')
    expect(weatherKind(3)).toBe('cloudy')
    expect(weatherKind(45)).toBe('fog')
    expect(weatherKind(53)).toBe('drizzle')
    expect(weatherKind(63)).toBe('rain')
    expect(weatherKind(75)).toBe('snow')
    expect(weatherKind(81)).toBe('showers')
    expect(weatherKind(95)).toBe('thunder')
  })
})

describe('Home stays light', () => {
  it('the Home page is a lazy chunk, mounted only while shown in an open shelf', () => {
    const panel = read('src/components/Panel.tsx')
    expect(panel).toContain("const HomePanel = lazy(() => import('./home/HomePanel'))")
    expect(panel).toContain('{homeOpen && open ? (')
    for (const f of ['src/components/Panel.tsx', 'src/components/Header.tsx', 'src/components/HomeToggle.tsx', 'src/App.tsx', 'src/main.tsx']) {
      expect(read(f), f).not.toMatch(/^import [^\n]*home\/(HomePanel|MusicCard|TimerCard|InfoCards|RulerPicker)/m)
    }
  })

  it('music: one-shot reads while watched, never a long-lived process', () => {
    const music = read('electron/main/music.ts')
    // A looping osascript survived kill() inside `delay` and outlived Raff.
    expect(music).not.toMatch(/\bspawn\(/)
    expect(music).not.toMatch(/for \(;;\)/)
    expect(music).toContain("execFile('/usr/bin/osascript', ['-l', 'JavaScript', '-e', READ]")
    // The next read is scheduled only while still watching, and never overlaps.
    expect(music).toContain('if (!watching || reading) return')
    expect(music).toContain('if (watching) timer = setTimeout(readOnce, READ_EVERY_MS)')
    // The card stops following when it unmounts.
    expect(read('src/components/home/MusicCard.tsx')).toContain('void edge.watchMusic(false)')
  })

  it('macOS asks once before Raff controls a music player', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.build.mac.extendInfo.NSAppleEventsUsageDescription).toMatch(/Music|Spotify/)
  })
})

describe('shelf themes', () => {
  it('black, glass-dark and glass; unknown values fall back to black', () => {
    expect(read('shared/types.ts')).toContain("export const SHELF_THEMES: ShelfTheme[] = ['black', 'glass-dark', 'glass']")
    expect(read('electron/store/settings.ts')).toContain("if (out.theme !== undefined && !SHELF_THEMES.includes(out.theme)) {")
  })

  it('glass reads the wallpaper through Quick Look (HEIC), only when asked', () => {
    const wall = read('electron/main/wallpaper.ts')
    expect(wall).toContain('nativeImage.createThumbnailFromPath(path')
    // Fetched by the hook when a glass theme is on and the shelf opens; nothing for black.
    expect(read('src/hooks/useGlassTheme.ts')).toContain("if (!blade || theme === 'black' || !open) return")
  })
})
