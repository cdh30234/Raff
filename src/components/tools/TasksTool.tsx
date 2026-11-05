/**
 * Tasks with an optional reminder time. The field borrows keyboard focus the
 * same way search does (the shelf never takes focus on its own); main sends
 * the reminder at the chosen time, shelf open or not. A time already past
 * today means tomorrow.
 */
import { useEffect, useRef, useState } from 'react'
import { acquireKeyboard, releaseKeyboard } from '../../lib/keyboardFocus'
import { localDay, type ToolTask, type ToolsData } from '../../../shared/tools'
import { formatClock } from './useTools'

const OWNER = 'tools-task'

interface Props {
  tasks: ToolTask[]
  update: (patch: Partial<ToolsData>) => void
  t: (key: string, params?: Record<string, string | number>) => string
  lang: string
}

/** "14:30" today, or tomorrow when that time has already gone. */
function dueFromClock(hhmm: string, now = Date.now()): number | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return undefined
  const d = new Date(now)
  d.setHours(Number(m[1]), Number(m[2]), 0, 0)
  if (d.getTime() <= now) d.setDate(d.getDate() + 1)
  return d.getTime()
}

export function TasksTool({ tasks, update, t, lang }: Props) {
  const [text, setText] = useState('')
  const [time, setTime] = useState('')
  const [withTime, setWithTime] = useState(false)
  const holding = useRef(false)

  const grab = () => {
    if (holding.current) return
    holding.current = true
    void acquireKeyboard(OWNER)
  }
  const letGo = () => {
    if (!holding.current) return
    holding.current = false
    releaseKeyboard(OWNER)
  }
  useEffect(() => () => letGo(), [])

  const add = () => {
    const value = text.trim()
    if (!value) return
    const task: ToolTask = { id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, text: value, done: false, createdAt: Date.now(), due: withTime ? dueFromClock(time) : undefined }
    update({ tasks: [task, ...tasks] })
    setText('')
    setTime('')
    setWithTime(false)
  }
  const setTasks = (next: ToolTask[]) => update({ tasks: next })
  const toggle = (id: string) => setTasks(tasks.map((x) => (x.id === id ? { ...x, done: !x.done } : x)))
  const remove = (id: string) => setTasks(tasks.filter((x) => x.id !== id))
  const clearDone = () => setTasks(tasks.filter((x) => !x.done))

  // Open first, then by reminder time, then newest.
  const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? Infinity) - (b.due ?? Infinity) || b.createdAt - a.createdAt)
  const left = tasks.filter((x) => !x.done).length
  const today = localDay(Date.now())

  return (
    <div className="tasks-tool">
      <form
        className="tasks-add"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input
          className="tools-input"
          value={text}
          maxLength={300}
          placeholder={t('tools.tasks.placeholder')}
          onPointerDown={grab}
          onFocus={grab}
          onBlur={letGo}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="button"
          className={`tools-icon-btn${withTime ? ' is-on' : ''}`}
          aria-pressed={withTime}
          title={t('tools.tasks.remind')}
          aria-label={t('tools.tasks.remind')}
          onClick={() => setWithTime(!withTime)}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="13" r="7.5" />
            <path d="M12 9.5V13l2.4 1.6M5 4.5 3 6.5M19 4.5l2 2" />
          </svg>
        </button>
        <button type="submit" className="tools-btn is-primary" disabled={!text.trim()}>{t('tools.tasks.add')}</button>
        {withTime && (
          <label className="tasks-time">
            <span>{t('tools.tasks.remind')}</span>
            <input type="time" className="tools-input is-time" value={time} onPointerDown={grab} onFocus={grab} onBlur={letGo} onChange={(e) => setTime(e.target.value)} />
          </label>
        )}
      </form>

      {sorted.length === 0 ? (
        <div className="tools-empty">
          <strong>{t('tools.tasks.none')}</strong>
          <span>{t('tools.tasks.noneHint')}</span>
        </div>
      ) : (
        <ul className="tasks-list">
          {sorted.map((task) => (
            <li key={task.id} className={`task${task.done ? ' is-done' : ''}`}>
              <button type="button" className="task-check" role="checkbox" aria-checked={task.done} aria-label={task.text} onClick={() => toggle(task.id)}>
                {task.done && (
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                )}
              </button>
              <span className="task-text" dir="auto">{task.text}</span>
              {task.due && !task.done && (
                <span className={`task-due${task.notified ? ' is-past' : ''}`}>
                  {localDay(task.due) !== today ? `${t('tools.tasks.tomorrow')} ` : ''}
                  {formatClock(task.due, lang)}
                </span>
              )}
              <button type="button" className="task-remove" aria-label={t('tools.tasks.remove')} title={t('tools.tasks.remove')} onClick={() => remove(task.id)}>
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {tasks.length > 0 && (
        <div className="tasks-foot">
          <span className="tools-muted">{t('tools.tasks.left', { count: left })}</span>
          {tasks.some((x) => x.done) && <button type="button" className="tools-link" onClick={clearDone}>{t('tools.tasks.clearDone')}</button>}
        </div>
      )}
    </div>
  )
}
