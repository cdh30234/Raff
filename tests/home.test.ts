import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'


const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

describe('Home stays light', () => {
  it('the Home page is a lazy chunk, mounted only while shown in an open shelf', () => {
    const panel = read('src/components/Panel.tsx')
    expect(panel).toContain("const HomePanel = lazy(() => import('./home/HomePanel'))")
    expect(panel).toContain('{homeOpen && open ? (')
    // The emoji picker and the tools page are gone: nothing else lazy in the shelf.
    expect(panel).not.toContain('EmojiPicker')
    expect(panel).not.toContain('ToolsPanel')
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
  it('black plus three glass themes; unknown values fall back to black', () => {
    expect(read('shared/types.ts')).toContain("export const SHELF_THEMES: ShelfTheme[] = ['black', 'glass-dark', 'liquid', 'glass']")
    expect(read('electron/store/settings.ts')).toContain("if (out.theme !== undefined && !SHELF_THEMES.includes(out.theme)) {")
  })

  it('glass reads the wallpaper through Quick Look (HEIC), only when asked', () => {
    const wall = read('electron/main/wallpaper.ts')
    expect(wall).toContain('nativeImage.createThumbnailFromPath(path')
    // Fetched by the hook when a glass theme is on and the shelf opens; nothing for black.
    expect(read('src/hooks/useGlassTheme.ts')).toContain("if (!blade || theme === 'black' || !open) return")
  })
})

describe('Liquid Glass themes', () => {
  const read = (p: string) => require('node:fs').readFileSync(require('node:path').join(__dirname, '..', p), 'utf8') as string
  it('offers black plus three glass looks, each styled', async () => {
    const { SHELF_THEMES } = await import('../shared/types')
    expect(SHELF_THEMES).toEqual(['black', 'glass-dark', 'liquid', 'glass'])
    const css = read('src/styles/themes.css')
    for (const th of ['glass-dark', 'liquid', 'glass']) {
      expect(css, th).toContain(`.blade-container.theme-${th} .blade::before`)
      expect(css, th).toContain(`.blade-container.theme-${th} .blade::after`)
    }
    expect(css).toContain('backdrop-filter')
    expect(css).toContain('prefers-reduced-transparency')
    expect(read('src/components/Settings.tsx')).toContain("val: 'liquid'")
  })
})
