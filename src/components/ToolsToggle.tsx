/**
 * The tools page toggle. Top dock: in the header beside the emoji button.
 * Side docks: the header is already full at 270px, so it sits in the footer.
 * Hovering it warms the lazy tools chunk, so the first open is instant.
 */
import { useStore } from '../store/appStore'
import { useTranslation } from '../i18n'
import { playButtonClickSound } from '../lib/soundEffects'
import { ToolsIcon } from './icons'

export function ToolsToggle({ tabIndex }: { tabIndex?: number }) {
  const { t } = useTranslation()
  const toolsOpen = useStore((s) => s.toolsOpen)
  const setToolsOpen = useStore((s) => s.setToolsOpen)
  return (
    <button
      type="button"
      className={`emoji-mode-btn${toolsOpen ? ' active' : ''}`}
      aria-pressed={toolsOpen}
      aria-label={t('tools.open')}
      title={t('tools.open')}
      tabIndex={tabIndex}
      onPointerEnter={() => void import('./tools/ToolsPanel')}
      onClick={() => {
        playButtonClickSound()
        setToolsOpen(!toolsOpen)
      }}
    >
      <ToolsIcon width={14} height={14} />
    </button>
  )
}
