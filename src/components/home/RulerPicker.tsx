/**
 * A horizontal ruler for picking minutes (1..max): a tick every minute, a label
 * every five, a fixed pointer in the middle. Drag, scroll or use the arrow keys;
 * it snaps to whole minutes and ticks softly as each one passes.
 *
 * Native scrolling does the motion (smooth, GPU-composited); the value is just
 * scrollLeft / STEP. Always left-to-right: it is a number line.
 */
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { playDialTickSound } from '../../lib/soundEffects'

const STEP = 14 // px per minute

interface Props {
  value: number
  max?: number
  onChange: (minutes: number) => void
  label: string
  lang: string
}

export function RulerPicker({ value, max = 120, onChange, label, lang }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const last = useRef(value)
  const drag = useRef<{ x: number; left: number; id: number } | null>(null)
  const nf = new Intl.NumberFormat(lang)

  // Start on the current value.
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollLeft = (value - 1) * STEP
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    const minutes = Math.min(max, Math.max(1, Math.round(el.scrollLeft / STEP) + 1))
    if (minutes !== last.current) {
      last.current = minutes
      playDialTickSound()
      onChange(minutes)
    }
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !ref.current) return
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, id: e.pointerId }
    ref.current.setPointerCapture(e.pointerId)
    ref.current.classList.add('is-dragging')
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId || !ref.current) return
    ref.current.scrollLeft = d.left - (e.clientX - d.x)
  }
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId || !ref.current) return
    drag.current = null
    ref.current.classList.remove('is-dragging')
    // Settle on the nearest minute.
    ref.current.scrollTo({ left: (last.current - 1) * STEP, behavior: 'smooth' })
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (!step || !ref.current) return
    e.preventDefault()
    const next = Math.min(max, Math.max(1, last.current + step))
    ref.current.scrollTo({ left: (next - 1) * STEP, behavior: 'smooth' })
  }

  return (
    <div className="ruler" dir="ltr">
      <div
        ref={ref}
        className="ruler-track"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={max}
        aria-valuenow={value}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <div className="ruler-ticks" style={{ width: (max - 1) * STEP }}>
          {Array.from({ length: max }, (_, i) => {
            const minute = i + 1
            const major = minute === 1 || minute % 5 === 0
            return (
              <span key={minute} className={`ruler-tick${major ? ' is-major' : ''}`} style={{ left: i * STEP }}>
                {major && <span className="ruler-label">{nf.format(minute)}</span>}
              </span>
            )
          })}
        </div>
      </div>
      <span className="ruler-pointer" aria-hidden="true" />
    </div>
  )
}
