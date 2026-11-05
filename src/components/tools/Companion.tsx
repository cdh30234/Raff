/**
 * The resting companion: two eyes on the tools page.
 *
 * They follow the pointer, blink on their own, doze off when nothing has moved
 * for a while (lids half closed, a slow "z") and wake with a little hop when
 * the pointer comes back. Blinks, dozing and the hop are CSS animations; the
 * only script is one pointermove listener, throttled to a frame, that exists
 * only while this page is open. Nothing runs when the shelf is closed: the
 * whole tools page is unmounted then.
 */
import { useEffect, useRef, useState } from 'react'

const DOZE_AFTER_MS = 12_000

export function Companion({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [look, setLook] = useState({ x: 0, y: 0 })
  const [resting, setResting] = useState(false)
  const [waking, setWaking] = useState(false)

  useEffect(() => {
    let frame = 0
    let restingNow = false
    const startDoze = () =>
      window.setTimeout(() => {
        restingNow = true
        setResting(true)
      }, DOZE_AFTER_MS)
    let doze = startDoze()
    const onMove = (e: PointerEvent) => {
      window.clearTimeout(doze)
      doze = startDoze()
      if (restingNow) {
        restingNow = false
        setResting(false)
        setWaking(true)
        window.setTimeout(() => setWaking(false), 600)
      }
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const box = ref.current?.getBoundingClientRect()
        if (!box) return
        const dx = e.clientX - (box.left + box.width / 2)
        const dy = e.clientY - (box.top + box.height / 2)
        const len = Math.hypot(dx, dy) || 1
        const reach = Math.min(1, len / 160)
        setLook({ x: (dx / len) * reach, y: (dy / len) * reach })
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.clearTimeout(doze)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const pupil = { transform: `translate(${(look.x * 3.2).toFixed(2)}px, ${(look.y * 2.6).toFixed(2)}px)` }
  return (
    <div
      ref={ref}
      className={`companion${resting ? ' is-resting' : ''}${waking ? ' is-waking' : ''}`}
      role="img"
      aria-label={label}
      title={label}
      // Ignore RTL: the eyes look where the pointer really is.
      dir="ltr"
    >
      <span className="companion-eye"><span className="companion-pupil" style={pupil} /></span>
      <span className="companion-eye"><span className="companion-pupil" style={pupil} /></span>
      <span className="companion-z" aria-hidden="true">z</span>
    </div>
  )
}
