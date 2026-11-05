/**
 * Glass themes: puts the (blurred) wallpaper behind the shelf, lined up with
 * where it really is on screen, so the shelf reads as frosted glass.
 *
 * Only for 'glass' and 'glass-dark'; 'black' does nothing. The wallpaper is
 * fetched when the shelf opens (main caches it), and the offset recomputed then
 * and on window resizes — no timers, nothing while the shelf is closed.
 */
import { useEffect, type RefObject } from 'react'
import { edge } from '../lib/edge'
import type { ShelfTheme } from '../../shared/types'

/** How far the blurred layer overhangs the blade, so the blur has no faded edges. */
export const GLASS_BLEED_PX = 48

export function useGlassTheme(bladeRef: RefObject<HTMLDivElement | null>, theme: ShelfTheme, open: boolean): void {
  useEffect(() => {
    const blade = bladeRef.current
    if (!blade || theme === 'black' || !open) return
    let alive = true
    let wall: Awaited<ReturnType<typeof edge.getWallpaper>> = null

    const place = () => {
      if (!wall || !blade.isConnected) return
      const r = blade.getBoundingClientRect()
      // The layer starts GLASS_BLEED_PX up and left of the blade.
      const x = -(wall.windowX + r.left - GLASS_BLEED_PX)
      const y = -(wall.windowY + r.top - GLASS_BLEED_PX)
      blade.style.setProperty('--glass-size', `${wall.screenWidth}px ${wall.screenHeight}px`)
      blade.style.setProperty('--glass-pos', `${Math.round(x)}px ${Math.round(y)}px`)
    }

    void edge.getWallpaper().then((w) => {
      if (!alive) return
      wall = w
      if (w) {
        blade.style.setProperty('--glass-image', `url("${w.dataUrl}")`)
        place()
      } else {
        blade.style.removeProperty('--glass-image')
      }
    })
    window.addEventListener('resize', place)
    return () => {
      alive = false
      window.removeEventListener('resize', place)
    }
  }, [bladeRef, theme, open])
}
