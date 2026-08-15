import { splitWorkspacePath } from './workspace-path.ts'

const maxSessionNameLength = 30

/** Formats the browser tab title for the current workspace and session.
 *
 * The repo name is derived from the basename of the workspace path. The session
 * name is truncated so the title remains readable in a crowded browser tab bar.
 */
export function formatDocumentTitle(workspacePath: string, sessionName?: string): string {
  const repo = workspacePath ? splitWorkspacePath(workspacePath).basename : 'Pi Livecraft'
  const base = `Pi: ${repo}`
  if (!sessionName) return base

  const truncated = sessionName.length > maxSessionNameLength
    ? `${sessionName.slice(0, maxSessionNameLength - 1)}…`
    : sessionName
  return `${base} ${truncated}`
}
