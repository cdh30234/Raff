import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const win = readFileSync(join(__dirname, '..', 'electron/main/window.ts'), 'utf8')

describe('macOS top dock hangs over the menu bar', () => {
  it('only on macOS, only for the top dock', () => {
    expect(win).toContain("return process.platform === 'darwin' && macNativeAvailable && stickPosition === 'top'")
  })

  it('the window may sit over the menu bar (frameless + enableLargerThanScreen)', () => {
    // Electron keeps setBounds below the menu bar unless the window opts in.
    expect(win).toMatch(/type: 'panel' as const, hiddenInMissionControl: true, enableLargerThanScreen: true/)
  })

  it('position and hover edge both use the display top, not the work area', () => {
    // Position: the shelf's y is the display's real top.
    expect(win).toContain('const top = withMenuBar({ x: result.x, y: result.y, width: result.width, height: result.height }, resolved.id)')
    // Hover: the trigger edge follows it, so the pointer at the very top opens the shelf.
    expect(win).toContain('const wa = coversMenuBar(settings.stickPosition) ? withMenuBar(cachedWa, currentStickDisplayId) : cachedWa')
    // The work area itself is untouched (it identifies the saved display across restarts).
    expect(win).toContain('workArea: { ...d.workArea },')
  })
})
