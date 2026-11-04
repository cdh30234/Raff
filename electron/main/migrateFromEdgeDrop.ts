/**
 * One-time carry-over for people who ran the Edge-Drop macOS build before it
 * became Raff: the app name sets the data folder (~/Library/Application
 * Support/<name>), so without this Raff would start from default settings.
 *
 * Only settings.json comes over (language, edge, shortcut, appearance). The
 * history cannot: items.json is encrypted with safeStorage, whose key lives in
 * the macOS Keychain under the app's name ("Edge-Drop Safe Storage"), so Raff
 * could not read it and would set it aside as unreadable. The old folder is
 * left as it was.
 */
import { app } from 'electron'
import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const OLD_NAMES = ['Edge-Drop', 'edge-drop']
const DATA = ['settings.json']

export function migrateFromEdgeDrop(): void {
  if (process.platform !== 'darwin') return
  try {
    const target = app.getPath('userData')
    if (existsSync(join(target, 'settings.json'))) return
    const source = OLD_NAMES.map((n) => join(app.getPath('appData'), n)).find((dir) => dir !== target && existsSync(join(dir, 'settings.json')))
    if (!source) return
    for (const entry of DATA) {
      const from = join(source, entry)
      if (existsSync(from)) cpSync(from, join(target, entry), { recursive: true, errorOnExist: false, force: false })
    }
    console.log(`[Migrate] Copied settings from ${source}`)
  } catch (err) {
    console.error('[Migrate] Edge-Drop settings could not be copied:', err)
  }
}
