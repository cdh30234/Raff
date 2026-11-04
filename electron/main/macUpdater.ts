/**
 * Updates for the macOS build, without an Apple Developer ID.
 *
 * electron-updater on macOS goes through Squirrel.Mac, which refuses an update
 * unless the app is signed with a Developer ID. Raff is ad-hoc signed, so it
 * updates itself from its GitHub releases instead:
 *
 *   1. check   GitHub API: the latest release of BRAND.repo, newer than this version?
 *   2. notify  a macOS notification + the shelf's own update prompt
 *   3. download  the release's Raff-<v>-mac-<arch>.zip, with progress, into temp
 *   4. verify  its SHA-512 against the release's latest-mac.yml (electron-builder writes it)
 *   5. install  after the app quits, a small script swaps the .app bundle (the old one
 *               is kept until the new one is in place) and opens the new version
 *
 * If the app cannot replace itself (not in a writable folder, or not a packaged
 * .app), the release page opens instead, so the user can download it by hand.
 */
import { app, net, Notification, shell } from 'electron'
import { createHash } from 'node:crypto'
import { accessSync, constants, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { BRAND } from '../../shared/brand'

export interface MacRelease {
  version: string
  pageUrl: string
  zipName: string
  zipUrl: string
  zipSize: number
  /** URL of latest-mac.yml in the same release (holds the zip's SHA-512). */
  metaUrl?: string
}

const userAgent = (): string => `${BRAND.name}/${app.getVersion()} (macOS updater)`

/** "1.10.0" > "1.9.2": numeric compare, any leading "v" ignored. */
export function isNewer(latest: string, current: string): boolean {
  const a = latest.replace(/^v/i, '').split('.').map((x) => parseInt(x, 10) || 0)
  const b = current.replace(/^v/i, '').split('.').map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0)
  }
  return false
}

function get(url: string, timeoutMs: number): Promise<{ status: number; body: Buffer } | null> {
  return new Promise((done) => {
    try {
      const req = net.request({ url, redirect: 'follow' })
      req.setHeader('User-Agent', userAgent())
      if (url.includes('api.github.com')) req.setHeader('Accept', 'application/vnd.github+json')
      const timer = setTimeout(() => {
        try { req.abort() } catch { /* ignore */ }
        done(null)
      }, timeoutMs)
      req.on('response', (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(Buffer.from(c)))
        res.on('end', () => {
          clearTimeout(timer)
          done({ status: res.statusCode, body: Buffer.concat(chunks) })
        })
      })
      req.on('error', () => {
        clearTimeout(timer)
        done(null)
      })
      req.end()
    } catch {
      done(null)
    }
  })
}

/** The latest published release that has a zip for this Mac's architecture, or null. */
export async function fetchLatestRelease(): Promise<MacRelease | null> {
  const res = await get(`https://api.github.com/repos/${BRAND.repo}/releases/latest`, 8000)
  if (!res || res.status !== 200) return null
  try {
    const rel = JSON.parse(res.body.toString('utf8')) as {
      tag_name?: string
      html_url?: string
      assets?: { name: string; browser_download_url: string; size: number }[]
    }
    const version = (rel.tag_name || '').replace(/^v/i, '')
    const zip = rel.assets?.find((a) => a.name.endsWith(`-mac-${process.arch}.zip`))
    if (!version || !zip) return null
    const meta = rel.assets?.find((a) => a.name === 'latest-mac.yml')
    return {
      version,
      pageUrl: rel.html_url || BRAND.releasesUrl,
      zipName: zip.name,
      zipUrl: zip.browser_download_url,
      zipSize: zip.size,
      metaUrl: meta?.browser_download_url
    }
  } catch {
    return null
  }
}

/** The zip's SHA-512 (base64) from latest-mac.yml, or null when the release has none. */
async function expectedSha512(release: MacRelease): Promise<string | null> {
  if (!release.metaUrl) return null
  const res = await get(release.metaUrl, 8000)
  if (!res || res.status !== 200) return null
  const yml = res.body.toString('utf8')
  // files:
  //   - url: Raff-1.1.0-mac-arm64.zip
  //     sha512: <base64>
  const at = yml.indexOf(`url: ${release.zipName}`)
  if (at < 0) return null
  const m = /sha512:\s*([A-Za-z0-9+/=]+)/.exec(yml.slice(at))
  return m ? m[1] : null
}

function updateDir(version: string): string {
  return join(app.getPath('temp'), `${BRAND.name}-update`, version)
}

/**
 * Download the release zip into temp, reporting progress (0..100). Resolves the
 * zip's path once its size and SHA-512 check out; rejects otherwise.
 */
export async function downloadRelease(release: MacRelease, onProgress: (p: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void): Promise<string> {
  const sha = await expectedSha512(release)
  if (!sha) throw new Error('The release has no latest-mac.yml checksum; refusing an unverified update.')
  const dir = updateDir(release.version)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const zipPath = join(dir, release.zipName)

  await new Promise<void>((done, fail) => {
    const req = net.request({ url: release.zipUrl, redirect: 'follow' })
    req.setHeader('User-Agent', userAgent())
    req.on('response', (res) => {
      if (res.statusCode !== 200) {
        fail(new Error(`Download failed: HTTP ${res.statusCode}`))
        return
      }
      const total = Number(res.headers['content-length']) || release.zipSize
      const out = createWriteStream(zipPath)
      const hash = createHash('sha512')
      const started = Date.now()
      let transferred = 0
      let lastReport = 0
      res.on('data', (chunk) => {
        const buf = Buffer.from(chunk)
        transferred += buf.length
        hash.update(buf)
        out.write(buf)
        const now = Date.now()
        if (now - lastReport > 250) {
          lastReport = now
          const secs = Math.max(0.001, (now - started) / 1000)
          onProgress({ percent: Math.min(99, Math.round((transferred / total) * 100)), transferred, total, bytesPerSecond: Math.round(transferred / secs) })
        }
      })
      res.on('end', () => {
        out.end(() => {
          if (hash.digest('base64') !== sha) {
            fail(new Error('Checksum mismatch: the downloaded update is not the published one.'))
            return
          }
          onProgress({ percent: 100, transferred, total, bytesPerSecond: 0 })
          done()
        })
      })
      res.on('error', (err: Error) => fail(err))
    })
    req.on('error', (err) => fail(err))
    req.end()
  })
  return zipPath
}

/** The running .app bundle (/Applications/Raff.app), or null when not running from one. */
function currentBundle(): string | null {
  const bundle = resolve(process.execPath, '../../..')
  return app.isPackaged && bundle.endsWith('.app') ? bundle : null
}

/**
 * Unpack the verified zip and hand the swap to a detached script that waits for
 * this process to exit. Returns false (nothing changed) when the app cannot
 * replace itself; the caller then opens the release page.
 */
export function installAndRelaunch(zipPath: string): boolean {
  const bundle = currentBundle()
  if (!bundle) return false
  try {
    accessSync(dirname(bundle), constants.W_OK)
  } catch {
    return false
  }
  const stage = join(dirname(zipPath), 'unpacked')
  rmSync(stage, { recursive: true, force: true })
  mkdirSync(stage, { recursive: true })
  execFileSync('/usr/bin/ditto', ['-x', '-k', zipPath, stage])
  const fresh = join(stage, `${BRAND.name}.app`)
  if (!existsSync(fresh)) return false

  // Old bundle -> backup, new -> place, then open it. If the move fails the
  // backup goes back, so the user is never left without the app.
  const backup = `${bundle}.previous`
  const script = join(dirname(zipPath), 'install.sh')
  writeFileSync(
    script,
    [
      '#!/bin/sh',
      `PID=${process.pid}`,
      `APP=${JSON.stringify(bundle)}`,
      `NEW=${JSON.stringify(fresh)}`,
      `OLD=${JSON.stringify(backup)}`,
      'while kill -0 "$PID" 2>/dev/null; do sleep 0.2; done',
      'rm -rf "$OLD"',
      'mv "$APP" "$OLD" || exit 1',
      'if mv "$NEW" "$APP"; then',
      '  rm -rf "$OLD"',
      '  /usr/bin/xattr -dr com.apple.quarantine "$APP" 2>/dev/null',
      'else',
      '  mv "$OLD" "$APP"',
      'fi',
      'open "$APP"',
      ''
    ].join('\n'),
    { mode: 0o755 }
  )
  spawn('/bin/sh', [script], { detached: true, stdio: 'ignore' }).unref()
  return true
}

/** Open the release page in the browser (manual download fallback). */
export function openReleasePage(release?: MacRelease | null): void {
  void shell.openExternal(release?.pageUrl || BRAND.releasesUrl)
}

/** A macOS notification for a new version; a click runs `onClick` (open the shelf's update prompt). */
export function notifyUpdate(title: string, body: string, onClick: () => void): void {
  try {
    if (!Notification.isSupported()) return
    const n = new Notification({ title, body, silent: false })
    n.on('click', onClick)
    n.show()
  } catch (err) {
    console.warn('[MacUpdater] notification failed:', err)
  }
}

/** Version we already notified about, so a relaunch does not repeat the same notification. */
const notifiedFile = () => join(app.getPath('userData'), 'update-notified.txt')
export function alreadyNotified(version: string): boolean {
  try {
    return readFileSync(notifiedFile(), 'utf8').trim() === version
  } catch {
    return false
  }
}
export function rememberNotified(version: string): void {
  try {
    writeFileSync(notifiedFile(), version)
  } catch { /* ignore */ }
}
