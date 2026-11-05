/**
 * Raff's tools in the main process: storage, reminders and prayer times.
 *
 * Cheap by design. One small JSON file; one timer, set for the nearest thing
 * that will happen (a focus phase ending, a task reminder, the next prayer)
 * and re-armed after each, after every change and when the Mac wakes — no
 * polling. The prayer library (adhan) is only loaded once the prayer page is
 * turned on. Nothing here runs on the clipboard path.
 */
import { app, Notification, powerMonitor } from 'electron'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mainT } from './i18n'
import {
  advanceFocus,
  cityForTimeZone,
  DEFAULT_TIMER,
  defaultFocus,
  localDay,
  PRAYER_CITIES,
  PRAYER_IDS,
  type PrayerDay,
  type PrayerId,
  type ToolsData,
  type ToolsState
} from '../../shared/tools'

interface StoredTools extends ToolsData {
  /** `${day}-${prayer}` of the last prayer notification, so it is never sent twice. */
  lastPrayerNotified?: string
}

/** Re-check at least this often, so sleep or a clock change never leaves a reminder stuck. */
const MAX_WAIT_MS = 5 * 60 * 1000
const MAX_TASKS = 200
const MAX_TASK_CHARS = 300

let data: StoredTools | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let broadcast: (state: ToolsState) => void = () => {}
let openTools: () => void = () => {}

const file = (): string => join(app.getPath('userData'), 'tools.json')

function defaults(): StoredTools {
  const city = cityForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  return {
    tasks: [],
    focus: defaultFocus(),
    timer: { ...DEFAULT_TIMER },
    prayer: { enabled: true, cityId: city.id, method: city.method, hanafiAsr: false, notify: false },
    companion: true
  }
}

function load(): StoredTools {
  if (data) return data
  const base = defaults()
  try {
    if (existsSync(file())) {
      const raw = JSON.parse(readFileSync(file(), 'utf8')) as Partial<StoredTools>
      data = {
        ...base,
        ...raw,
        focus: { ...base.focus, ...(raw.focus ?? {}) },
        timer: { ...base.timer, ...(raw.timer ?? {}) },
        prayer: { ...base.prayer, ...(raw.prayer ?? {}) },
        tasks: Array.isArray(raw.tasks) ? raw.tasks : []
      }
      // Najaf / Karbala / Basra used to default to MWL; their usual method is Ja'fari.
      if (['najaf', 'karbala', 'basra'].includes(data.prayer.cityId) && data.prayer.method === 'MuslimWorldLeague') data.prayer.method = 'Jafari'
      return data
    }
  } catch (err) {
    console.error('[Tools] tools.json unreadable, starting fresh:', err)
  }
  data = base
  return data
}

function save(): void {
  if (!data) return
  try {
    const tmp = `${file()}.tmp`
    writeFileSync(tmp, JSON.stringify(data))
    renameSync(tmp, file())
  } catch (err) {
    console.error('[Tools] could not save tools.json:', err)
  }
}

/* ------------------------------------------------------------------ */
/* Prayer times                                                        */
/* ------------------------------------------------------------------ */

type Adhan = typeof import('adhan')
let adhan: Adhan | null = null
let adhanLoading: Promise<Adhan | null> | null = null

function loadAdhan(): Promise<Adhan | null> {
  if (adhan) return Promise.resolve(adhan)
  adhanLoading ??= import('adhan')
    .then((m) => (adhan = m))
    .catch((err) => {
      console.error('[Tools] prayer library failed to load:', err)
      return null
    })
  return adhanLoading
}

/**
 * Calculation parameters. Ja'fari (Shia Ithna Ashari, as used in Najaf and
 * Qum): Fajr at 16°, Isha at 14°, and Maghrib when the sun is 4° below the
 * horizon — after the redness in the east has gone, not at sunset.
 */
function prayerParams(a: Adhan, method: ToolsData['prayer']['method']) {
  if (method === 'Jafari') return new a.CalculationParameters('Other', 16, 14, 0, 4)
  const known = a.CalculationMethod[method as keyof typeof a.CalculationMethod] ?? a.CalculationMethod.MuslimWorldLeague
  return known()
}

/** Prayer times for the local day containing `ms`, or null when off / unavailable. */
function prayerDay(d: StoredTools, ms: number): PrayerDay | null {
  if (!d.prayer.enabled || !adhan) return null
  const city = PRAYER_CITIES.find((c) => c.id === d.prayer.cityId) ?? cityForTimeZone(undefined)
  const params = prayerParams(adhan, d.prayer.method)
  if (d.prayer.hanafiAsr) params.madhab = adhan.Madhab.Hanafi
  const day = new Date(ms)
  const pt = new adhan.PrayerTimes(new adhan.Coordinates(city.lat, city.lon), day, params)
  return { date: localDay(ms), times: PRAYER_IDS.map((id) => ({ id, at: (pt[id] as Date).getTime() })) }
}

/** The next prayer after `now` (sunrise is not a prayer), looking into tomorrow if needed. */
function nextPrayer(d: StoredTools, now: number): { id: PrayerId; at: number } | null {
  for (const offset of [0, 1]) {
    const day = prayerDay(d, now + offset * 86_400_000)
    const next = day?.times.find((t) => t.id !== 'sunrise' && t.at > now)
    if (next) return next
  }
  return null
}

/* ------------------------------------------------------------------ */
/* State, reminders                                                    */
/* ------------------------------------------------------------------ */

function snapshot(): ToolsState {
  const d = load()
  const now = Date.now()
  // A day passed since the last focus round: today's count starts over.
  if (d.focus.doneDate !== localDay(now)) d.focus = { ...d.focus, doneToday: 0, doneDate: localDay(now) }
  const { lastPrayerNotified: _omit, ...shown } = d
  return { ...shown, prayerToday: prayerDay(d, now), prayerNext: nextPrayer(d, now) }
}

function notify(title: string, body: string): void {
  try {
    if (!Notification.isSupported()) return
    const n = new Notification({ title, body })
    n.on('click', () => openTools())
    n.show()
  } catch (err) {
    console.warn('[Tools] notification failed:', err)
  }
}

/** Handle everything due by now, then arm the timer for whatever comes next. */
function tick(): void {
  const d = load()
  const now = Date.now()
  let changed = false

  if (d.focus.status === 'running' && d.focus.endsAt && d.focus.endsAt <= now + 500) {
    const ended = d.focus.phase
    d.focus = advanceFocus(d.focus, now)
    changed = true
    if (ended === 'focus') notify(mainT('tools.focus.doneTitle'), mainT(d.focus.phase === 'long' ? 'tools.focus.doneLongBody' : 'tools.focus.doneBody'))
    else notify(mainT('tools.focus.breakOverTitle'), mainT('tools.focus.breakOverBody'))
  }

  if (d.timer.status === 'running' && d.timer.endsAt && d.timer.endsAt <= now + 500) {
    const minutes = d.timer.durationMin
    d.timer = { ...d.timer, status: 'idle', endsAt: undefined, remainingMs: undefined }
    changed = true
    notify(mainT('tools.timer.doneTitle'), mainT('tools.timer.doneBody', { minutes }))
  }

  for (const task of d.tasks) {
    if (!task.done && task.due && !task.notified && task.due <= now + 500) {
      task.notified = true
      changed = true
      notify(mainT('tools.tasks.reminderTitle'), task.text)
    }
  }

  if (d.prayer.enabled && d.prayer.notify && adhan) {
    const today = prayerDay(d, now)
    // The latest prayer whose time has come in the last 10 minutes and was not announced yet.
    const due = today?.times.filter((t) => t.id !== 'sunrise' && t.at <= now + 500 && now - t.at < 10 * 60_000).pop()
    const key = due ? `${today!.date}-${due.id}` : ''
    if (due && d.lastPrayerNotified !== key) {
      d.lastPrayerNotified = key
      changed = true
      notify(mainT('tools.prayer.notifyTitle', { prayer: mainT(`tools.prayer.names.${due.id}`) }), mainT('tools.prayer.notifyBody'))
    }
  }

  if (changed) {
    save()
    broadcast(snapshot())
  }
  arm()
}

function arm(): void {
  if (timer) clearTimeout(timer)
  timer = null
  const d = load()
  const now = Date.now()
  const times: number[] = []
  if (d.focus.status === 'running' && d.focus.endsAt) times.push(d.focus.endsAt)
  if (d.timer.status === 'running' && d.timer.endsAt) times.push(d.timer.endsAt)
  for (const t of d.tasks) if (!t.done && t.due && !t.notified) times.push(t.due)
  if (d.prayer.enabled && d.prayer.notify) {
    const next = nextPrayer(d, now)
    if (next) times.push(next.at)
  }
  if (!times.length) return
  const wait = Math.min(Math.max(0, Math.min(...times) - now), MAX_WAIT_MS)
  timer = setTimeout(tick, wait)
}

/* ------------------------------------------------------------------ */
/* Public API (ipc.ts / index.ts)                                      */
/* ------------------------------------------------------------------ */

export function getToolsState(): Promise<ToolsState> {
  const d = load()
  return (d.prayer.enabled ? loadAdhan() : Promise.resolve(null)).then(() => snapshot())
}

/** Apply a change from the tools page; returns the new state. */
export async function updateTools(patch: Partial<ToolsData>): Promise<ToolsState> {
  const d = load()
  if (patch.focus) d.focus = { ...d.focus, ...patch.focus }
  if (patch.timer) d.timer = { ...d.timer, ...patch.timer, durationMin: Math.min(120, Math.max(1, Math.round(patch.timer.durationMin ?? d.timer.durationMin))) }
  if (patch.prayer) d.prayer = { ...d.prayer, ...patch.prayer }
  if (typeof patch.companion === 'boolean') d.companion = patch.companion
  if (patch.tasks) {
    d.tasks = patch.tasks.slice(0, MAX_TASKS).map((t) => ({ ...t, text: String(t.text).slice(0, MAX_TASK_CHARS) }))
  }
  if (d.prayer.enabled) await loadAdhan()
  save()
  arm()
  const state = snapshot()
  broadcast(state)
  return state
}

/**
 * Start reminders at launch. Reads tools.json (a few KB) only; the prayer
 * library loads in the background only when prayer reminders are on.
 */
export function initTools(opts: { broadcast: (state: ToolsState) => void; openTools: () => void }): void {
  broadcast = opts.broadcast
  openTools = opts.openTools
  const d = load()
  if (d.prayer.enabled && d.prayer.notify) void loadAdhan().then(() => arm())
  else arm()
  powerMonitor.on('resume', () => tick())
}
