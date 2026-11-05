/**
 * Data for the Home page's apps card: the user's Dock apps
 * (`defaults read com.apple.dock`), with icons. Read when the page asks for
 * it and cached; nothing runs while the shelf is closed.
 */
import { nativeImage, shell } from 'electron'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'

export interface HomeApp {
  name: string
  path: string
  /** PNG data URL, 64px. */
  icon: string
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
