import type { SessionTab } from './session-tabs.ts'

interface SessionTabsProps {
  selectedId: string
  tabs: readonly SessionTab[]
  onClose: (sessionId: string) => void
  onSelect: (sessionId: string) => void
}

export function SessionTabs({ selectedId, tabs, onClose, onSelect }: SessionTabsProps) {
  return (
    <div aria-label='Open sessions' className='session-tabs' role='tablist'>
      {tabs.map((tab) => (
        <div className='session-tab' key={tab.id}>
          <button
            aria-selected={tab.id === selectedId}
            onClick={() => onSelect(tab.id)}
            role='tab'
            type='button'
          >
            {tab.running && <span aria-label='Running' className='session-tab-activity' />}
            <span className='session-tab-title'>{tab.title}</span>
          </button>
          <button
            aria-label={`Close ${tab.title}`}
            className='session-tab-close'
            onClick={(event) => {
              event.stopPropagation()
              onClose(tab.id)
            }}
            type='button'
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
