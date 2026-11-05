/**
 * The desktop picture for Raff's glass themes.
 *
 * Electron's vibrancy blurs the whole window rectangle, not the shelf's shape
 * (the window is larger than the blade and mostly transparent), so the glass
 * is drawn instead: the wallpaper, scaled down once, blurred by the renderer
 * and positioned exactly where it sits behind the shelf on screen.
 *
 * Cheap: read only when a glass theme is on and the shelf asks; kept as one
 * small JPEG data URL, rebuilt only when the picture file changes.
 */
import { nativeImage, screen, type BrowserWindow } from 'electron'
import { statSync } from 'node:fs'
import { macDesktopImagePath } from './macNative'

export interface ShelfWallpaper {
  /** Scaled-down wallpaper (JPEG data URL). */
  dataUrl: string
  /** The display the wallpaper covers, in screen points. */
  screenWidth: number
  screenHeight: number
  /** Where the shelf window's top-left corner sits on that display. */
  windowX: number
  windowY: number
}

/** Width the wallpaper is scaled to before blurring: plenty for a 30px+ blur. */
const WIDTH = 960

let cache: { key: string; dataUrl: string } | null = null

async function wallpaperDataUrl(): Promise<string | null> {
  if (process.platform !== 'darwin') return null
  const path = macDesktopImagePath()
  if (!path) return null
  let key: string
  try {
    key = `${path}|${statSync(path).mtimeMs}`
  } catch {
    return null
  }
  if (cache?.key === key) return cache.dataUrl
  // Quick Look reads every format macOS wallpapers come in (HEIC included);
  // nativeImage.createFromPath only reads PNG/JPEG.
  let image = await nativeImage.createThumbnailFromPath(path, { width: WIDTH, height: WIDTH }).catch(() => null)
  if (!image || image.isEmpty()) image = nativeImage.createFromPath(path)
  if (image.isEmpty()) return null
  const small = image.getSize().width > WIDTH ? image.resize({ width: WIDTH, quality: 'good' }) : image
  cache = { key, dataUrl: `data:image/jpeg;base64,${small.toJPEG(82).toString('base64')}` }
  return cache.dataUrl
}

/** The wallpaper and the window's place on it, or null when there is none to show. */
export async function getShelfWallpaper(win: BrowserWindow | null): Promise<ShelfWallpaper | null> {
  if (!win || win.isDestroyed()) return null
  try {
    const dataUrl = await wallpaperDataUrl()
    if (!dataUrl || win.isDestroyed()) return null
    const bounds = win.getBounds()
    // The wallpaper is the primary screen's: macDesktopImagePath reads screen 0.
    const display = screen.getPrimaryDisplay()
    return {
      dataUrl,
      screenWidth: display.bounds.width,
      screenHeight: display.bounds.height,
      windowX: bounds.x - display.bounds.x,
      windowY: bounds.y - display.bounds.y
    }
  } catch (err) {
    console.warn('[Wallpaper] unavailable:', err)
    return null
  }
}
