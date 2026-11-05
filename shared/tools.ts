/**
 * Raff's tools: focus timer, tasks with reminders, prayer times and the
 * resting companion. Shared by main (storage, reminders, prayer maths) and
 * the renderer (the lazily loaded tools page).
 */

export interface ToolTask {
  id: string
  text: string
  done: boolean
  /** Reminder time (epoch ms), if any. */
  due?: number
  /** The reminder fired; editing `due` clears it. */
  notified?: boolean
  createdAt: number
}

export type FocusPhase = 'focus' | 'short' | 'long'

export interface FocusState {
  phase: FocusPhase
  status: 'idle' | 'running' | 'paused'
  /** While running: when the current phase ends (epoch ms). */
  endsAt?: number
  /** While paused: what was left of the phase. */
  remainingMs?: number
  /** Focus rounds finished in the current cycle (0..rounds). */
  round: number
  focusMin: number
  shortMin: number
  longMin: number
  /** Focus rounds before a long break. */
  rounds: number
  /** Focus rounds finished today, and which day "today" is (YYYY-MM-DD). */
  doneToday: number
  doneDate: string
}

export type PrayerMethodId =
  | 'UmmAlQura'
  | 'MuslimWorldLeague'
  | 'Egyptian'
  | 'Karachi'
  | 'Dubai'
  | 'Kuwait'
  | 'Qatar'
  | 'Turkey'
  | 'Tehran'
  | 'NorthAmerica'
  | 'Singapore'
  | 'MoonsightingCommittee'

export const PRAYER_METHODS: { id: PrayerMethodId; en: string; ar: string }[] = [
  { id: 'UmmAlQura', en: 'Umm al-Qura (Makkah)', ar: 'أم القرى (مكة)' },
  { id: 'MuslimWorldLeague', en: 'Muslim World League', ar: 'رابطة العالم الإسلامي' },
  { id: 'Egyptian', en: 'Egyptian General Authority', ar: 'الهيئة المصرية العامة للمساحة' },
  { id: 'Karachi', en: 'University of Karachi', ar: 'جامعة العلوم الإسلامية بكراتشي' },
  { id: 'Dubai', en: 'Dubai', ar: 'دبي' },
  { id: 'Kuwait', en: 'Kuwait', ar: 'الكويت' },
  { id: 'Qatar', en: 'Qatar', ar: 'قطر' },
  { id: 'Turkey', en: 'Diyanet (Turkey)', ar: 'رئاسة الشؤون الدينية (تركيا)' },
  { id: 'Tehran', en: 'Tehran', ar: 'طهران' },
  { id: 'NorthAmerica', en: 'ISNA (North America)', ar: 'أمريكا الشمالية (ISNA)' },
  { id: 'Singapore', en: 'Singapore', ar: 'سنغافورة' },
  { id: 'MoonsightingCommittee', en: 'Moonsighting Committee', ar: 'لجنة رؤية الهلال' }
]

export interface PrayerCity {
  id: string
  en: string
  ar: string
  lat: number
  lon: number
  /** IANA zone, used to guess the city from the Mac's own time zone. */
  tz: string
  method: PrayerMethodId
}

/** Cities to pick from; the default is guessed from the system time zone. */
export const PRAYER_CITIES: PrayerCity[] = [
  { id: 'baghdad', en: 'Baghdad', ar: 'بغداد', lat: 33.3152, lon: 44.3661, tz: 'Asia/Baghdad', method: 'MuslimWorldLeague' },
  { id: 'basra', en: 'Basra', ar: 'البصرة', lat: 30.5085, lon: 47.7804, tz: 'Asia/Baghdad', method: 'MuslimWorldLeague' },
  { id: 'erbil', en: 'Erbil', ar: 'أربيل', lat: 36.1911, lon: 44.0092, tz: 'Asia/Baghdad', method: 'MuslimWorldLeague' },
  { id: 'najaf', en: 'Najaf', ar: 'النجف', lat: 32.0259, lon: 44.3462, tz: 'Asia/Baghdad', method: 'MuslimWorldLeague' },
  { id: 'makkah', en: 'Makkah', ar: 'مكة المكرمة', lat: 21.4225, lon: 39.8262, tz: 'Asia/Riyadh', method: 'UmmAlQura' },
  { id: 'madinah', en: 'Madinah', ar: 'المدينة المنورة', lat: 24.4686, lon: 39.6142, tz: 'Asia/Riyadh', method: 'UmmAlQura' },
  { id: 'riyadh', en: 'Riyadh', ar: 'الرياض', lat: 24.7136, lon: 46.6753, tz: 'Asia/Riyadh', method: 'UmmAlQura' },
  { id: 'jeddah', en: 'Jeddah', ar: 'جدة', lat: 21.5433, lon: 39.1728, tz: 'Asia/Riyadh', method: 'UmmAlQura' },
  { id: 'dammam', en: 'Dammam', ar: 'الدمام', lat: 26.4207, lon: 50.0888, tz: 'Asia/Riyadh', method: 'UmmAlQura' },
  { id: 'kuwait', en: 'Kuwait City', ar: 'الكويت', lat: 29.3759, lon: 47.9774, tz: 'Asia/Kuwait', method: 'Kuwait' },
  { id: 'doha', en: 'Doha', ar: 'الدوحة', lat: 25.2854, lon: 51.531, tz: 'Asia/Qatar', method: 'Qatar' },
  { id: 'manama', en: 'Manama', ar: 'المنامة', lat: 26.2285, lon: 50.586, tz: 'Asia/Bahrain', method: 'UmmAlQura' },
  { id: 'dubai', en: 'Dubai', ar: 'دبي', lat: 25.2048, lon: 55.2708, tz: 'Asia/Dubai', method: 'Dubai' },
  { id: 'abudhabi', en: 'Abu Dhabi', ar: 'أبوظبي', lat: 24.4539, lon: 54.3773, tz: 'Asia/Dubai', method: 'Dubai' },
  { id: 'muscat', en: 'Muscat', ar: 'مسقط', lat: 23.588, lon: 58.3829, tz: 'Asia/Muscat', method: 'UmmAlQura' },
  { id: 'sanaa', en: "Sana'a", ar: 'صنعاء', lat: 15.3694, lon: 44.191, tz: 'Asia/Aden', method: 'UmmAlQura' },
  { id: 'amman', en: 'Amman', ar: 'عمّان', lat: 31.9454, lon: 35.9284, tz: 'Asia/Amman', method: 'MuslimWorldLeague' },
  { id: 'damascus', en: 'Damascus', ar: 'دمشق', lat: 33.5138, lon: 36.2765, tz: 'Asia/Damascus', method: 'MuslimWorldLeague' },
  { id: 'beirut', en: 'Beirut', ar: 'بيروت', lat: 33.8938, lon: 35.5018, tz: 'Asia/Beirut', method: 'MuslimWorldLeague' },
  { id: 'jerusalem', en: 'Jerusalem', ar: 'القدس', lat: 31.7683, lon: 35.2137, tz: 'Asia/Jerusalem', method: 'MuslimWorldLeague' },
  { id: 'gaza', en: 'Gaza', ar: 'غزة', lat: 31.5017, lon: 34.4668, tz: 'Asia/Gaza', method: 'Egyptian' },
  { id: 'cairo', en: 'Cairo', ar: 'القاهرة', lat: 30.0444, lon: 31.2357, tz: 'Africa/Cairo', method: 'Egyptian' },
  { id: 'alexandria', en: 'Alexandria', ar: 'الإسكندرية', lat: 31.2001, lon: 29.9187, tz: 'Africa/Cairo', method: 'Egyptian' },
  { id: 'khartoum', en: 'Khartoum', ar: 'الخرطوم', lat: 15.5007, lon: 32.5599, tz: 'Africa/Khartoum', method: 'Egyptian' },
  { id: 'tripoli', en: 'Tripoli', ar: 'طرابلس', lat: 32.8872, lon: 13.1913, tz: 'Africa/Tripoli', method: 'Egyptian' },
  { id: 'tunis', en: 'Tunis', ar: 'تونس', lat: 36.8065, lon: 10.1815, tz: 'Africa/Tunis', method: 'MuslimWorldLeague' },
  { id: 'algiers', en: 'Algiers', ar: 'الجزائر', lat: 36.7538, lon: 3.0588, tz: 'Africa/Algiers', method: 'MuslimWorldLeague' },
  { id: 'casablanca', en: 'Casablanca', ar: 'الدار البيضاء', lat: 33.5731, lon: -7.5898, tz: 'Africa/Casablanca', method: 'MuslimWorldLeague' },
  { id: 'rabat', en: 'Rabat', ar: 'الرباط', lat: 34.0209, lon: -6.8416, tz: 'Africa/Casablanca', method: 'MuslimWorldLeague' },
  { id: 'nouakchott', en: 'Nouakchott', ar: 'نواكشوط', lat: 18.0735, lon: -15.9582, tz: 'Africa/Nouakchott', method: 'MuslimWorldLeague' },
  { id: 'istanbul', en: 'Istanbul', ar: 'إسطنبول', lat: 41.0082, lon: 28.9784, tz: 'Europe/Istanbul', method: 'Turkey' },
  { id: 'ankara', en: 'Ankara', ar: 'أنقرة', lat: 39.9334, lon: 32.8597, tz: 'Europe/Istanbul', method: 'Turkey' },
  { id: 'tehran', en: 'Tehran', ar: 'طهران', lat: 35.6892, lon: 51.389, tz: 'Asia/Tehran', method: 'Tehran' },
  { id: 'karachi', en: 'Karachi', ar: 'كراتشي', lat: 24.8607, lon: 67.0011, tz: 'Asia/Karachi', method: 'Karachi' },
  { id: 'jakarta', en: 'Jakarta', ar: 'جاكرتا', lat: -6.2088, lon: 106.8456, tz: 'Asia/Jakarta', method: 'Singapore' },
  { id: 'kualalumpur', en: 'Kuala Lumpur', ar: 'كوالالمبور', lat: 3.139, lon: 101.6869, tz: 'Asia/Kuala_Lumpur', method: 'Singapore' },
  { id: 'london', en: 'London', ar: 'لندن', lat: 51.5074, lon: -0.1278, tz: 'Europe/London', method: 'MoonsightingCommittee' },
  { id: 'paris', en: 'Paris', ar: 'باريس', lat: 48.8566, lon: 2.3522, tz: 'Europe/Paris', method: 'MuslimWorldLeague' },
  { id: 'berlin', en: 'Berlin', ar: 'برلين', lat: 52.52, lon: 13.405, tz: 'Europe/Berlin', method: 'MuslimWorldLeague' },
  { id: 'stockholm', en: 'Stockholm', ar: 'ستوكهولم', lat: 59.3293, lon: 18.0686, tz: 'Europe/Stockholm', method: 'MuslimWorldLeague' },
  { id: 'newyork', en: 'New York', ar: 'نيويورك', lat: 40.7128, lon: -74.006, tz: 'America/New_York', method: 'NorthAmerica' },
  { id: 'toronto', en: 'Toronto', ar: 'تورنتو', lat: 43.6532, lon: -79.3832, tz: 'America/Toronto', method: 'NorthAmerica' },
  { id: 'losangeles', en: 'Los Angeles', ar: 'لوس أنجلوس', lat: 34.0522, lon: -118.2437, tz: 'America/Los_Angeles', method: 'NorthAmerica' },
  { id: 'sydney', en: 'Sydney', ar: 'سيدني', lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney', method: 'MuslimWorldLeague' }
]

/** The listed city for a time zone (exact zone first), else Makkah. */
export function cityForTimeZone(tz: string | undefined): PrayerCity {
  return PRAYER_CITIES.find((c) => c.tz === tz) ?? PRAYER_CITIES.find((c) => c.id === 'makkah')!
}

export type PrayerId = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'
export const PRAYER_IDS: PrayerId[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']

export interface PrayerSettings {
  /** Show the prayer page. */
  enabled: boolean
  cityId: string
  method: PrayerMethodId
  /** Hanafi (later) Asr. */
  hanafiAsr: boolean
  /** A notification at each prayer time (never at sunrise). */
  notify: boolean
}

export interface ToolsData {
  tasks: ToolTask[]
  focus: FocusState
  prayer: PrayerSettings
  /** The resting companion (eyes) on the tools page and the empty shelf. */
  companion: boolean
}

export interface PrayerDay {
  /** Local calendar day, YYYY-MM-DD. */
  date: string
  times: { id: PrayerId; at: number }[]
}

/** What the renderer gets: the stored data plus today's prayer times. */
export interface ToolsState extends ToolsData {
  prayerToday: PrayerDay | null
  /** The next prayer (sunrise excluded), possibly tomorrow's Fajr. */
  prayerNext: { id: PrayerId; at: number } | null
}

/** Local YYYY-MM-DD of `ms`. */
export function localDay(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function defaultFocus(now = Date.now()): FocusState {
  return { phase: 'focus', status: 'idle', round: 0, focusMin: 25, shortMin: 5, longMin: 15, rounds: 4, doneToday: 0, doneDate: localDay(now) }
}

export function phaseMinutes(f: FocusState): number {
  return f.phase === 'focus' ? f.focusMin : f.phase === 'short' ? f.shortMin : f.longMin
}

/**
 * The focus state after the running phase ends: a focus round counts and is
 * followed by a break (long after every `rounds`); a break leads back to focus.
 * The next phase waits for the user (status 'idle').
 */
export function advanceFocus(f: FocusState, now = Date.now()): FocusState {
  const today = localDay(now)
  const doneToday = f.doneDate === today ? f.doneToday : 0
  if (f.phase === 'focus') {
    const round = f.round + 1
    const long = round >= f.rounds
    return { ...f, status: 'idle', endsAt: undefined, remainingMs: undefined, phase: long ? 'long' : 'short', round: long ? f.rounds : round, doneToday: doneToday + 1, doneDate: today }
  }
  return { ...f, status: 'idle', endsAt: undefined, remainingMs: undefined, phase: 'focus', round: f.phase === 'long' ? 0 : f.round, doneToday, doneDate: today }
}
