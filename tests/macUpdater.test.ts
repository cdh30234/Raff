import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const spawned: string[][] = []

vi.mock('electron', () => ({
  app: { isPackaged: true, getVersion: () => '1.0.0', getPath: () => tmpdir() },
  net: { request: vi.fn() },
  shell: { openExternal: vi.fn() },
  Notification: { isSupported: () => false }
}))
vi.mock('node:child_process', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:child_process')>()
  return {
    ...real,
    // Record the install script instead of starting it detached.
    spawn: vi.fn((cmd: string, args: string[]) => {
      spawned.push([cmd, ...args])
      return { unref: () => {} }
    })
  }
})

import { installAndRelaunch, isNewer } from '../electron/main/macUpdater'

describe('macOS updater: version compare', () => {
  it('compares numerically, ignoring a leading v', () => {
    expect(isNewer('1.0.1', '1.0.0')).toBe(true)
    expect(isNewer('v1.10.0', '1.9.9')).toBe(true)
    expect(isNewer('1.0.0', '1.0.0')).toBe(false)
    expect(isNewer('0.9.9', '1.0.0')).toBe(false)
    expect(isNewer('2', '1.9.9')).toBe(true)
  })
})

/** A minimal .app bundle whose version file tells old from new. */
function fakeBundle(dir: string, version: string): string {
  const app = join(dir, 'Raff.app')
  mkdirSync(join(app, 'Contents', 'MacOS'), { recursive: true })
  writeFileSync(join(app, 'Contents', 'MacOS', 'Raff'), '#!/bin/sh\n')
  writeFileSync(join(app, 'Contents', 'version.txt'), version)
  return app
}

describe.skipIf(process.platform !== 'darwin')('macOS updater: install swaps the app bundle', () => {
  let root = ''
  const realExec = process.execPath
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'raff-update-test-'))
  })
  afterAll(() => {
    Object.defineProperty(process, 'execPath', { value: realExec })
    rmSync(root, { recursive: true, force: true })
  })

  it('replaces the running app with the new one and removes the backup', () => {
    // Installed v1.0.0 in a writable "Applications" folder.
    const apps = join(root, 'Applications')
    mkdirSync(apps)
    const installed = fakeBundle(apps, '1.0.0')
    Object.defineProperty(process, 'execPath', { value: join(installed, 'Contents', 'MacOS', 'Raff') })

    // The downloaded release zip with v1.0.1, as electron-builder packs it.
    const build = join(root, 'build')
    mkdirSync(build)
    fakeBundle(build, '1.0.1')
    const dl = join(root, 'download')
    mkdirSync(dl)
    const zip = join(dl, 'Raff-1.0.1-mac-arm64.zip')
    execFileSync('/usr/bin/ditto', ['-c', '-k', '--keepParent', join(build, 'Raff.app'), zip])

    expect(installAndRelaunch(zip)).toBe(true)
    const [cmd, script] = spawned.at(-1)!
    expect(cmd).toBe('/bin/sh')

    // Run the real script, as if this process had already quit, without reopening the app.
    const body = readFileSync(script, 'utf8').replace(/^PID=\d+$/m, 'PID=999999').replace(/^open "\$APP"$/m, 'true')
    writeFileSync(script, body)
    execFileSync('/bin/sh', [script])

    expect(readFileSync(join(installed, 'Contents', 'version.txt'), 'utf8')).toBe('1.0.1')
    expect(existsSync(`${installed}.previous`)).toBe(false)
  })

  it('does nothing when the app folder is not writable', () => {
    const locked = join(root, 'Locked')
    mkdirSync(locked)
    const installed = fakeBundle(locked, '1.0.0')
    Object.defineProperty(process, 'execPath', { value: join(installed, 'Contents', 'MacOS', 'Raff') })
    execFileSync('/bin/chmod', ['a-w', locked])
    try {
      expect(installAndRelaunch(join(root, 'download', 'Raff-1.0.1-mac-arm64.zip'))).toBe(false)
      expect(readFileSync(join(installed, 'Contents', 'version.txt'), 'utf8')).toBe('1.0.0')
    } finally {
      execFileSync('/bin/chmod', ['u+w', locked])
    }
  })
})
