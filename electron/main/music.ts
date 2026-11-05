/**
 * Now playing for the Home page: Apple Music and Spotify, through AppleScript.
 *
 * macOS 15.4 closed the system-wide Now Playing API (MediaRemote) to third-party
 * apps, so Raff talks to the two players directly. macOS asks the user once to
 * let Raff control each player (NSAppleEventsUsageDescription in Info.plist).
 *
 * Cost: while the Home page watches, a one-shot `osascript` (JavaScript for
 * Automation) reads the state once a second and exits — nothing long-lived, so
 * nothing can be left running if Raff quits or crashes (a looping script
 * survived kill() inside `delay` and outlived its parent). The next read waits
 * for the previous one. It never launches a player that is not running.
 * Commands (play/pause, next, previous, seek) are one-shot calls too.
 */
import { app, nativeImage, net } from 'electron'
import { execFile } from 'node:child_process'
import { join } from 'node:path'

export type MusicPlayer = 'Music' | 'Spotify'

export interface MusicState {
  player: MusicPlayer | null
  playing: boolean
  title: string
  artist: string
  album: string
  /** Seconds. */
  duration: number
  position: number
  /** Artwork as a data URL, once loaded. */
  artwork: string | null
  /** When `position` was read (epoch ms), so the view can advance it smoothly. */
  at: number
  /** The player refused Automation (the user said no in the macOS prompt). */
  denied?: MusicPlayer
}

export const NO_MUSIC: MusicState = { player: null, playing: false, title: '', artist: '', album: '', duration: 0, position: 0, artwork: null, at: 0 }

/** One read: the playing player wins; never launches a player. Prints one JSON line. */
const READ = `
function read(name) {
  try {
    const p = Application(name)
    if (!p.running()) return null
    const st = p.playerState()
    if (st === 'stopped') return null
    const t = p.currentTrack
    const ms = name === 'Spotify'
    return {
      player: name,
      playing: st === 'playing',
      title: t.name() || '',
      artist: t.artist() || '',
      album: t.album() || '',
      duration: ms ? (t.duration() || 0) / 1000 : (t.duration() || 0),
      position: p.playerPosition() || 0,
      art: ms ? (t.artworkUrl() || '') : '',
      key: ms ? t.id() : String(t.persistentID())
    }
  } catch (e) {
    const m = String(e)
    if (m.indexOf('-1743') >= 0 || m.toLowerCase().indexOf('not authorized') >= 0) return { player: name, denied: true }
    return null
  }
}
function run() {
  const s = read('Spotify'), m = read('Music')
  const pick = (s && s.playing) ? s : (m && m.playing) ? m : (s || m || {})
  return JSON.stringify(pick)
}`

const READ_EVERY_MS = 1000

let state: MusicState = NO_MUSIC
let artKey = ''
let push: (s: MusicState) => void = () => {}

function emit(next: MusicState): void {
  state = next
  push(state)
}

async function loadArtwork(raw: { player: MusicPlayer; key: string; art: string }): Promise<void> {
  const key = `${raw.player}:${raw.key}`
  if (key === artKey) return
  artKey = key
  let image: Electron.NativeImage | null = null
  try {
    if (raw.player === 'Spotify' && raw.art.startsWith('https://')) {
      const buf = await new Promise<Buffer | null>((done) => {
        const req = net.request(raw.art)
        req.on('response', (res) => {
          const parts: Buffer[] = []
          res.on('data', (c) => parts.push(Buffer.from(c)))
          res.on('end', () => done(res.statusCode === 200 ? Buffer.concat(parts) : null))
        })
        req.on('error', () => done(null))
        req.end()
      })
      if (buf) image = nativeImage.createFromBuffer(buf)
    } else if (raw.player === 'Music') {
      // Apple Music hands artwork out as raw data: write it once per track.
      const file = join(app.getPath('temp'), 'raff-now-playing-art')
      const script = `set p to POSIX file ${JSON.stringify(file)}
tell application "Music" to set d to raw data of artwork 1 of current track
set f to open for access p with write permission
set eof f to 0
write d to f
close access f`
      await new Promise<void>((done) => execFile('/usr/bin/osascript', ['-e', script], { timeout: 4000 }, () => done()))
      image = nativeImage.createFromPath(file)
    }
  } catch { /* no artwork */ }
  if (artKey !== key) return // the track changed meanwhile
  const art = image && !image.isEmpty() ? image.resize({ width: 300, quality: 'good' }).toDataURL() : null
  emit({ ...state, artwork: art })
}

function onLine(line: string): void {
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(line)
  } catch {
    return
  }
  if (!raw.player) {
    if (state.player) emit(NO_MUSIC)
    return
  }
  const player = raw.player as MusicPlayer
  if (raw.denied) {
    emit({ ...NO_MUSIC, denied: player })
    return
  }
  const key = `${player}:${String(raw.key)}`
  const sameTrack = key === artKey
  emit({
    player,
    playing: !!raw.playing,
    title: String(raw.title ?? ''),
    artist: String(raw.artist ?? ''),
    album: String(raw.album ?? ''),
    duration: Number(raw.duration) || 0,
    position: Number(raw.position) || 0,
    artwork: sameTrack ? state.artwork : null,
    at: Date.now()
  })
  if (!sameTrack) void loadArtwork({ player, key: String(raw.key), art: String(raw.art ?? '') })
}

let watching = false
let reading = false
let timer: ReturnType<typeof setTimeout> | null = null

/** One read; schedules the next while watching. Never two at once. */
function readOnce(): void {
  timer = null
  if (!watching || reading) return
  reading = true
  // `run()`'s return value is printed to stdout.
  execFile('/usr/bin/osascript', ['-l', 'JavaScript', '-e', READ], { timeout: 4000 }, (err, out) => {
    reading = false
    if (!err && out) onLine(String(out).trim())
    if (watching) timer = setTimeout(readOnce, READ_EVERY_MS)
  })
}

/** Start or stop following the players (the Home page is shown / hidden). */
export function watchMusic(on: boolean, onState: (s: MusicState) => void): MusicState {
  push = onState
  if (process.platform !== 'darwin') return NO_MUSIC
  watching = on
  if (on && !timer && !reading) readOnce()
  if (!on && timer) {
    clearTimeout(timer)
    timer = null
  }
  return state
}

export type MusicCommand = 'playpause' | 'next' | 'previous' | 'seek'

/** Control the player that is showing. `seek` takes seconds. */
export function musicCommand(cmd: MusicCommand, arg?: number): void {
  const player = state.player
  if (!player || process.platform !== 'darwin') return
  const verb =
    cmd === 'playpause' ? 'playpause'
    : cmd === 'next' ? 'next track'
    : cmd === 'previous' ? 'previous track'
    : `set player position to ${Math.max(0, Number(arg) || 0)}`
  execFile('/usr/bin/osascript', ['-e', `tell application "${player}" to ${verb}`], { timeout: 4000 }, () => {})
  // Show the change at once; the stream confirms it within a second.
  if (cmd === 'playpause') emit({ ...state, playing: !state.playing, at: Date.now() })
  if (cmd === 'seek') emit({ ...state, position: Math.max(0, Number(arg) || 0), at: Date.now() })
}

/** Stop following on quit. */
export function stopMusic(): void {
  watching = false
  if (timer) clearTimeout(timer)
  timer = null
}
