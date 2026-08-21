import type { DesktopTabState } from '../../../desktop/shared.ts'
import type { SessionSummary } from '../../../shared/types.ts'

export interface SessionTab {
  id: string
  running: boolean
  title: string
}

export function reconcileSessionTabs(
  persisted: readonly DesktopTabState[],
  sessions: readonly SessionSummary[],
  selectedId: string,
): SessionTab[] {
  const live = new Map(
    sessions.filter((session) => session.status !== 'exited').map((
      session,
    ) => [session.id, session]),
  )
  const ids = [...persisted.map(({ sessionId }) => sessionId), selectedId]
  return ids.filter((id, index) => id && ids.indexOf(id) === index).flatMap((id) => {
    const session = live.get(id)
    return session
      ? [{
        id,
        running: session.status === 'running' || session.status === 'starting',
        title: session.name,
      }]
      : []
  })
}

/** Returns the workspace that owns a visible tab, so cross-workspace selection uses the session controller. */
export function workspaceForSessionTab(
  sessionId: string,
  sessions: readonly SessionSummary[],
): string | undefined {
  return sessions.find((session) => session.id === sessionId)?.cwd
}

export function selectAfterTabClose(
  closedId: string,
  tabs: readonly SessionTab[],
  selectedId: string,
): string {
  if (closedId !== selectedId) return selectedId
  const index = tabs.findIndex((tab) => tab.id === closedId)
  return tabs[index + 1]?.id ?? tabs[index - 1]?.id ?? ''
}
