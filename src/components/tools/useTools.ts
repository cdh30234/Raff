/**
 * The tools page's state: loaded from main when the page mounts, kept in sync
 * with its pushes (a reminder fired, a focus phase ended), and changed through
 * one `update(patch)` that applies locally at once and then persists in main.
 * Nothing here exists while the page is closed.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { edge } from '../../lib/edge'
import type { ToolsData, ToolsState } from '../../../shared/tools'

export function useTools(): { state: ToolsState | null; update: (patch: Partial<ToolsData>) => void } {
  const [state, setState] = useState<ToolsState | null>(null)
  const latest = useRef(0)

  useEffect(() => {
    let alive = true
    void edge.getTools().then((s) => {
      if (alive) setState(s)
    })
    const off = edge.onTools((s) => setState(s))
    return () => {
      alive = false
      off()
    }
  }, [])

  const update = useCallback((patch: Partial<ToolsData>) => {
    setState((prev) => (prev ? { ...prev, ...patch } : prev))
    const call = ++latest.current
    void edge.setTools(patch).then((s) => {
      // An older reply must not undo a newer local change.
      if (call === latest.current) setState(s)
    })
  }, [])

  return { state, update }
}

/** Re-render every `ms` while `active` (a running timer, a countdown); idle otherwise. */
export function useTicker(active: boolean, ms: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [active, ms])
  return now
}

/** "9:41 PM" / "٩:٤١ م" in the interface language. */
export function formatClock(ms: number, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit' }).format(ms)
  } catch {
    return new Date(ms).toLocaleTimeString()
  }
}

/** "1 hr 8 min" / "٤٢ دقيقة" for a positive duration. */
export function formatDuration(ms: number, lang: string): string {
  const totalMin = Math.max(1, Math.round(ms / 60_000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const unit = (n: number, u: 'hour' | 'minute') => {
    try {
      return new Intl.NumberFormat(lang, { style: 'unit', unit: u, unitDisplay: 'short' }).format(n)
    } catch {
      return `${n} ${u === 'hour' ? 'h' : 'min'}`
    }
  }
  return h ? (m ? `${unit(h, 'hour')} ${unit(m, 'minute')}` : unit(h, 'hour')) : unit(m, 'minute')
}

/** "24:59" for a countdown, in the interface language's digits. */
export function formatTimer(ms: number, lang: string): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const nf = new Intl.NumberFormat(lang, { minimumIntegerDigits: 2, useGrouping: false })
  return `${nf.format(Math.floor(s / 60))}:${nf.format(s % 60)}`
}
