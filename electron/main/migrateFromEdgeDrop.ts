/**
 * One-time carry-over for people who ran the Edge-Drop macOS build before it
 * became Raff: the app name sets the data folder (~/Library/Application
 * Support/<name>), so without this Raff would open with an empty history.
 *
 * Copies only the app's own data (history, settings, images, long texts),
 * never Chromium's caches, and only when Raff has no history yet. The old
 * folder is left as it was.
 */
import { app } from 'electron'
import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const OLD_NAMES = ['Edge-Drop', 'edge-drop']
const DATA = ['items.json', 'settings.json', 'images', 'payloads']

export function migrateFromEdgeDrop(): void {
  if (process.platform !== 'darwin') return
  try {
    const target = app.getPath('userData')
    if (existsSync(join(target, 'items.json'))) return
    const source = OLD_NAMES.map((n) => join(app.getPath('appData'), n)).find((dir) => dir !== target && existsSync(join(dir, 'items.json')))
    if (!source) return
    for (const entry of DATA) {
      const from = join(source, entry)
      if (existsSync(from)) cpSync(from, join(target, entry), { recursive: true, errorOnExist: false, force: false })
    }
    console.log(`[Migrate] Copied history and settings from ${source}`)
  } catch (err) {
    console.error('[Migrate] Edge-Drop data could not be copied:', err)
  }
}
