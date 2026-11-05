/**
 * The Home page toggle (timer, music, apps, date, weather). Placed like the
 * tools toggle: header in the top dock, footer in side docks. Hovering warms
 * the lazy Home chunk, so the first open is instant.
 */
import { useStore } from '../store/appStore'
import { useTranslation } from '../i18n'
import { playButtonClickSound } from '../lib/soundEffects'
import { HomeIcon } from './icons'

export function HomeToggle({ tabIndex }: { tabIndex?: number }) {
  const { t } = useTranslation()
  const homeOpen = useStore((s) => s.homeOpen)
  const setHomeOpen = useStore((s) => s.setHomeOpen)
  return (
    <button
      type="button"
      className={`emoji-mode-btn${homeOpen ? ' active' : ''}`}
      aria-pressed={homeOpen}
      aria-label={t('tools.nav.home')}
      title={t('tools.nav.home')}
      tabIndex={tabIndex}
      onPointerEnter={() => void import('./home/HomePanel')}
      onClick={() => {
        playButtonClickSound()
        setHomeOpen(!homeOpen)
      }}
    >
      <HomeIcon width={14} height={14} />
    </button>
  )
}
