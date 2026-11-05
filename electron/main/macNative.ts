/**
 * macOS counterparts of the Win32 calls used elsewhere, via koffi + the
 * Objective-C runtime (no extra native module, no osascript spawn):
 *   - NSPasteboard changeCount   ~ GetClipboardSequenceNumber
 *   - NSPasteboard file URLs     ~ CF_HDROP read / SetFileDropList write
 *   - NSWorkspace frontmost pid  ~ GetForegroundWindow / SetForegroundWindow
 *   - CGEventPost Cmd+V          ~ SendKeys('^v')
 *
 * Everything is a no-op (null / false / 0) off macOS or if loading failed.
 */
import koffi from 'koffi'
import { systemPreferences } from 'electron'

type Id = unknown

interface ObjC {
  getClass: (name: string) => Id
  sel: (name: string) => Id
  msgId: (self: Id, sel: Id) => Id
  msgIdStr: (self: Id, sel: Id, arg: Id) => Id
  msgIdCStr: (self: Id, sel: Id, s: string) => Id
  msgIdIdx: (self: Id, sel: Id, i: number) => Id
  msgLong: (self: Id, sel: Id) => number
  msgInt: (self: Id, sel: Id) => number
  msgIdInt: (self: Id, sel: Id, i: number) => Id
  msgBoolUlong: (self: Id, sel: Id, opts: number) => boolean
  msgBoolId: (self: Id, sel: Id, arg: Id) => boolean
  msgVoidId: (self: Id, sel: Id, arg: Id) => void
  msgCStr: (self: Id, sel: Id) => string | null
  msgGetBytes: (self: Id, sel: Id, out: Buffer, len: number) => void
  poolPush: () => Id
  poolPop: (pool: Id) => void
}

interface CG {
  createKey: (source: Id, keyCode: number, down: boolean) => Id
  setFlags: (event: Id, flags: number) => void
  post: (tap: number, event: Id) => void
  release: (ref: Id) => void
}

let objc: ObjC | null = null
let cg: CG | null = null

if (process.platform === 'darwin') {
  try {
    koffi.load('/System/Library/Frameworks/AppKit.framework/AppKit')
    const rt = koffi.load('/usr/lib/libobjc.A.dylib')
    objc = {
      getClass: rt.func('void *objc_getClass(const char *name)'),
      sel: rt.func('void *sel_registerName(const char *name)'),
      msgId: rt.func('void *objc_msgSend(void *self, void *op)'),
      msgIdStr: rt.func('void *objc_msgSend(void *self, void *op, void *arg)'),
      msgIdCStr: rt.func('void *objc_msgSend(void *self, void *op, const char *s)'),
      msgIdIdx: rt.func('void *objc_msgSend(void *self, void *op, uint64_t i)'),
      msgLong: rt.func('int64_t objc_msgSend(void *self, void *op)'),
      msgInt: rt.func('int32_t objc_msgSend(void *self, void *op)'),
      msgIdInt: rt.func('void *objc_msgSend(void *self, void *op, int32_t i)'),
      msgBoolUlong: rt.func('bool objc_msgSend(void *self, void *op, uint64_t opts)'),
      msgBoolId: rt.func('bool objc_msgSend(void *self, void *op, void *arg)'),
      msgVoidId: rt.func('void objc_msgSend(void *self, void *op, void *arg)'),
      msgCStr: rt.func('const char *objc_msgSend(void *self, void *op)'),
      msgGetBytes: rt.func('void objc_msgSend(void *self, void *op, _Out_ uint8_t *buf, uint64_t len)'),
      poolPush: rt.func('void *objc_autoreleasePoolPush()'),
      poolPop: rt.func('void objc_autoreleasePoolPop(void *pool)')
    }
  } catch (err) {
    console.error('[macNative] Objective-C runtime load failed:', err)
    objc = null
  }
  try {
    const lib = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
    const core = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
    cg = {
      createKey: lib.func('void *CGEventCreateKeyboardEvent(void *source, uint16_t keyCode, bool keyDown)'),
      setFlags: lib.func('void CGEventSetFlags(void *event, uint64_t flags)'),
      post: lib.func('void CGEventPost(uint32_t tap, void *event)'),
      release: core.func('void CFRelease(void *cf)')
    }
  } catch (err) {
    console.error('[macNative] CoreGraphics load failed:', err)
    cg = null
  }
}

export const macNativeAvailable = objc !== null

/** Run `fn` inside an autorelease pool so temporaries do not pile up. */
function withPool<T>(fallback: T, fn: (o: ObjC) => T): T {
  const o = objc
  if (!o) return fallback
  const pool = o.poolPush()
  try {
    return fn(o)
  } catch (err) {
    console.error('[macNative] call failed:', err)
    return fallback
  } finally {
    o.poolPop(pool)
  }
}

function nsString(o: ObjC, s: string): Id {
  return o.msgIdCStr(o.getClass('NSString'), o.sel('stringWithUTF8String:'), s)
}

function generalPasteboard(o: ObjC): Id {
  return o.msgId(o.getClass('NSPasteboard'), o.sel('generalPasteboard'))
}

/** NSPasteboard.changeCount — bumps on every write, like the Win32 sequence number. */
export function macPasteboardChangeCount(): number {
  return withPool(0, (o) => Number(o.msgLong(generalPasteboard(o), o.sel('changeCount'))))
}

/**
 * The pasteboard's type identifiers (UTIs such as public.utf8-plain-text,
 * public.html, org.nspasteboard.ConcealedType), in the order the copying app
 * declared them. Empty when the pasteboard is empty or unreadable.
 */
export function macPasteboardTypes(): string[] {
  return withPool<string[]>([], (o) => {
    const types = o.msgId(generalPasteboard(o), o.sel('types'))
    if (!types) return []
    const count = Number(o.msgLong(types, o.sel('count')))
    const out: string[] = []
    for (let i = 0; i < count; i++) {
      const t = o.msgIdIdx(types, o.sel('objectAtIndex:'), i)
      const name = t ? o.msgCStr(t, o.sel('UTF8String')) : null
      if (name) out.push(name)
    }
    return out
  })
}

/** The string stored under `type` (default: plain text), or null when absent. */
export function macPasteboardString(type = 'public.utf8-plain-text'): string | null {
  return withPool<string | null>(null, (o) => {
    const str = o.msgIdStr(generalPasteboard(o), o.sel('stringForType:'), nsString(o, type))
    return str ? o.msgCStr(str, o.sel('UTF8String')) : null
  })
}

/** The raw bytes stored under `type`, or null when absent. */
export function macPasteboardData(type: string): Buffer | null {
  return withPool<Buffer | null>(null, (o) => {
    const data = o.msgIdStr(generalPasteboard(o), o.sel('dataForType:'), nsString(o, type))
    if (!data) return null
    const len = Number(o.msgLong(data, o.sel('length')))
    const out = Buffer.alloc(len)
    if (len > 0) o.msgGetBytes(data, o.sel('getBytes:length:'), out, len)
    return out
  })
}

/** Absolute paths of the file URLs on the general pasteboard (Finder copy), or null. */
export function macReadFileUrls(): string[] | null {
  return withPool<string[] | null>(null, (o) => {
    const items = o.msgId(generalPasteboard(o), o.sel('pasteboardItems'))
    if (!items) return null
    const count = Number(o.msgLong(items, o.sel('count')))
    const type = nsString(o, 'public.file-url')
    const paths: string[] = []
    for (let i = 0; i < count; i++) {
      const item = o.msgIdIdx(items, o.sel('objectAtIndex:'), i)
      const str = o.msgIdStr(item, o.sel('stringForType:'), type)
      if (!str) continue
      const url = o.msgCStr(str, o.sel('UTF8String'))
      if (!url || !url.startsWith('file://')) continue
      try {
        let p = decodeURIComponent(new URL(url).pathname)
        // Finder may hand out /.file/id=… reference URLs; resolve to a real path.
        if (p.startsWith('/.file/')) {
          const nsUrl = o.msgIdStr(o.getClass('NSURL'), o.sel('URLWithString:'), str)
          const resolved = nsUrl ? o.msgId(nsUrl, o.sel('filePathURL')) : null
          const rp = resolved ? o.msgCStr(o.msgId(resolved, o.sel('path')), o.sel('UTF8String')) : null
          if (rp) p = rp
        }
        if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
        paths.push(p)
      } catch { /* skip malformed */ }
    }
    return paths.length ? paths : null
  })
}

/** Put real file references on the pasteboard so Finder/Mail/Slack paste the files. */
export function macWriteFileUrls(paths: string[]): boolean {
  return withPool(false, (o) => {
    const pb = generalPasteboard(o)
    const arr = o.msgId(o.getClass('NSMutableArray'), o.sel('array'))
    for (const p of paths) {
      const url = o.msgIdStr(o.getClass('NSURL'), o.sel('fileURLWithPath:'), nsString(o, p))
      if (url) o.msgVoidId(arr, o.sel('addObject:'), url)
    }
    o.msgLong(pb, o.sel('clearContents'))
    return o.msgBoolId(pb, o.sel('writeObjects:'), arr)
  })
}

/** Bit mask of the mouse buttons held right now (bit 0: left, bit 1: right), 0 when none. */
export function macPressedMouseButtons(): number {
  return withPool(0, (o) => Number(o.msgLong(o.getClass('NSEvent'), o.sel('pressedMouseButtons'))))
}

/**
 * changeCount of the system drag pasteboard (NSPasteboardNameDrag). Every
 * drag-and-drop session, from any app, writes its payload there when it
 * starts, so a change while a button is held means a drag has begun.
 */
export function macDragPasteboardChangeCount(): number {
  return withPool(0, (o) => {
    const pb = o.msgIdStr(o.getClass('NSPasteboard'), o.sel('pasteboardWithName:'), nsString(o, 'Apple CFPasteboard drag'))
    return pb ? Number(o.msgLong(pb, o.sel('changeCount'))) : 0
  })
}

/** File path of the desktop picture on the primary screen, or null (none, or not a file). */
export function macDesktopImagePath(): string | null {
  return withPool<string | null>(null, (o) => {
    const ws = o.msgId(o.getClass('NSWorkspace'), o.sel('sharedWorkspace'))
    const screens = o.msgId(o.getClass('NSScreen'), o.sel('screens'))
    const screen = screens ? o.msgIdIdx(screens, o.sel('objectAtIndex:'), 0) : null
    const url = ws && screen ? o.msgIdStr(ws, o.sel('desktopImageURLForScreen:'), screen) : null
    const path = url ? o.msgId(url, o.sel('path')) : null
    return path ? o.msgCStr(path, o.sel('UTF8String')) : null
  })
}

/** pid of the frontmost application (0 when unknown). */
export function macFrontmostPid(): number {
  return withPool(0, (o) => {
    const ws = o.msgId(o.getClass('NSWorkspace'), o.sel('sharedWorkspace'))
    const app = o.msgId(ws, o.sel('frontmostApplication'))
    return app ? o.msgInt(app, o.sel('processIdentifier')) : 0
  })
}

/** Bring the app with `pid` to the front. */
export function macActivatePid(pid: number): boolean {
  if (!pid) return false
  return withPool(false, (o) => {
    const app = o.msgIdInt(o.getClass('NSRunningApplication'), o.sel('runningApplicationWithProcessIdentifier:'), pid)
    if (!app) return false
    // NSApplicationActivateIgnoringOtherApps (deprecated but still honoured)
    return o.msgBoolUlong(app, o.sel('activateWithOptions:'), 1 << 1)
  })
}

/** True when macOS lets us post key events. Prompts once when `prompt` is true. */
export function macCanSendKeys(prompt = false): boolean {
  if (process.platform !== 'darwin') return false
  try {
    return systemPreferences.isTrustedAccessibilityClient(prompt)
  } catch {
    return false
  }
}

const KEY_V = 9
const FLAG_COMMAND = 0x100000
const HID_EVENT_TAP = 0

/** Press Cmd+V in whatever app is frontmost. Needs Accessibility permission. */
export function macSendCmdV(): boolean {
  if (!cg || !macCanSendKeys(false)) return false
  const c = cg
  try {
    for (const down of [true, false]) {
      const ev = c.createKey(null, KEY_V, down)
      if (!ev) return false
      c.setFlags(ev, FLAG_COMMAND)
      c.post(HID_EVENT_TAP, ev)
      c.release(ev)
    }
    return true
  } catch (err) {
    console.error('[macNative] Cmd+V failed:', err)
    return false
  }
}
