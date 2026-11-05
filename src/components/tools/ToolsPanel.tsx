/**
 * Raff's tools page: focus timer, tasks and prayer times, with the resting
 * companion. A lazily loaded chunk (Panel.tsx): none of this code, its styles
 * or its state exist until the tools button is first pressed, and the page is
 * unmounted again whenever the shelf closes. Reminders live in main.
 *
 * Side docks show one tool at a time under tabs; the top dock is wide and
 * short, so it shows all three side by side.
 */
import { useState } from 'react'
import { SegmentedControl } from '../SegmentedControl'
import { useTranslation } from '../../i18n'
import { useStore } from '../../store/appStore'
import { Companion } from './Companion'
import { FocusTool } from './FocusTool'
import { TasksTool } from './TasksTool'
import { PrayerTool } from './PrayerTool'
import { useTools } from './useTools'
import '../../styles/tools.css'

type Tab = 'focus' | 'tasks' | 'prayer'
const TAB_KEY = 'raff.tools.tab'

function savedTab(): Tab {
  try {
    const v = localStorage.getItem(TAB_KEY)
    if (v === 'focus' || v === 'tasks' || v === 'prayer') return v
  } catch { /* storage unavailable */ }
  return 'focus'
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)
const TAB_ICONS: Record<Tab, JSX.Element> = {
  focus: icon('M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-12v4l2.5 2M9.5 2.5h5'),
  tasks: icon('M4 6.5 6 8.5l3.5-4M4 15.5l2 2 3.5-4M13 7h7M13 16h7'),
  prayer: icon('M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z')
}

export default function ToolsPanel({ isHorizontal }: { isHorizontal: boolean }) {
  const { t, resolvedLang } = useTranslation()
  const reduceMotion = useStore((s) => !!s.settings.reduceMotion)
  const { state, update } = useTools()
  const [tab, setTab] = useState<Tab>(savedTab)

  if (!state) return <div className="tools" aria-busy="true" />

  const choose = (next: Tab) => {
    setTab(next)
    try {
      localStorage.setItem(TAB_KEY, next)
    } catch { /* storage unavailable */ }
  }
  const companion = state.companion ? <Companion label={t('tools.companion.hello')} /> : null
  const focus = <FocusTool focus={state.focus} update={update} t={t} lang={resolvedLang} />
  const tasks = <TasksTool tasks={state.tasks} update={update} t={t} lang={resolvedLang} />
  const prayer = state.prayer.enabled ? <PrayerTool state={state} update={update} t={t} lang={resolvedLang} /> : null

  if (isHorizontal) {
    return (
      <div className="tools is-horizontal">
        {companion && <div className="tools-card tools-companion-card">{companion}</div>}
        <section className="tools-card" aria-label={t('tools.tabs.focus')}>{focus}</section>
        <section className="tools-card" aria-label={t('tools.tabs.tasks')}>{tasks}</section>
        {prayer && <section className="tools-card" aria-label={t('tools.tabs.prayer')}>{prayer}</section>}
      </div>
    )
  }

  const tabs = (['focus', 'tasks', 'prayer'] as Tab[]).filter((x) => x !== 'prayer' || state.prayer.enabled)
  const shown = tabs.includes(tab) ? tab : 'focus'
  return (
    <div className="tools">
      <div className="tools-top">
        {companion}
        <SegmentedControl
          items={tabs.map((x) => ({ value: x, label: t(`tools.tabs.${x}`), icon: TAB_ICONS[x] }))}
          value={shown}
          onChange={choose}
          ariaLabel={t('tools.title')}
          reduceMotion={reduceMotion}
        />
      </div>
      <div className="tools-body">
        {shown === 'focus' ? focus : shown === 'tasks' ? tasks : prayer}
      </div>
    </div>
  )
}
