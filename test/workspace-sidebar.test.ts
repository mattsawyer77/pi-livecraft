import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDocumentTitle } from '../src/features/workspace/document-title.ts'
import { nextActiveSessionId } from '../src/features/workspace/sidebar-sessions.ts'
import { splitWorkspacePath } from '../src/features/workspace/workspace-path.ts'
import {
  clampWorkspaceSidebarWidth,
  defaultWorkspaceSidebarWidth,
  maxWorkspaceSidebarWidth,
  minWorkspaceSidebarWidth,
  readWorkspaceSidebarCollapsed,
  readWorkspaceSidebarWidth,
} from '../src/features/workspace/workspace-sidebar.ts'

test('borne et restaure la largeur de la sidebar de sessions', () => {
  assert.equal(clampWorkspaceSidebarWidth(100), minWorkspaceSidebarWidth)
  assert.equal(clampWorkspaceSidebarWidth(999), maxWorkspaceSidebarWidth)
  assert.equal(clampWorkspaceSidebarWidth(320.6), 321)
  assert.equal(readWorkspaceSidebarWidth(null), defaultWorkspaceSidebarWidth)
  assert.equal(readWorkspaceSidebarWidth('invalid'), defaultWorkspaceSidebarWidth)
  assert.equal(readWorkspaceSidebarCollapsed('true'), true)
  assert.equal(readWorkspaceSidebarCollapsed('false'), false)
  assert.equal(readWorkspaceSidebarCollapsed('invalid'), false)
})

test('split un chemin de workspace en parent et basename', () => {
  assert.deepEqual(splitWorkspacePath('/Users/m.sawyer/workspaces/pi-livecraft'), {
    parent: '/Users/m.sawyer/workspaces',
    basename: 'pi-livecraft',
  })
  assert.deepEqual(splitWorkspacePath('/Users/m.sawyer/workspaces/pi-livecraft/'), {
    parent: '/Users/m.sawyer/workspaces',
    basename: 'pi-livecraft',
  })
  assert.deepEqual(splitWorkspacePath('/foo'), { parent: '/', basename: 'foo' })
  assert.deepEqual(splitWorkspacePath('/'), { parent: '', basename: '/' })
  assert.deepEqual(splitWorkspacePath('~'), { parent: '', basename: '~' })
  assert.deepEqual(splitWorkspacePath('~/projects/app'), { parent: '~/projects', basename: 'app' })
  assert.deepEqual(splitWorkspacePath('.'), { parent: '', basename: '.' })
  assert.deepEqual(splitWorkspacePath('..'), { parent: '', basename: '..' })
  assert.deepEqual(splitWorkspacePath('repo'), { parent: '', basename: 'repo' })
  assert.deepEqual(splitWorkspacePath(''), { parent: '', basename: '' })
  assert.deepEqual(splitWorkspacePath('C:\\Users\\foo'), {
    parent: 'C:\\Users',
    basename: 'foo',
  })
  assert.deepEqual(splitWorkspacePath('C:\\'), { parent: '', basename: 'C:\\' })
})

test('formate le titre du navigateur avec repo et nom de session tronqué', () => {
  assert.equal(formatDocumentTitle('/Users/m.sawyer/workspaces/pi-livecraft'), 'Pi: pi-livecraft')
  assert.equal(
    formatDocumentTitle('/Users/m.sawyer/workspaces/pi-livecraft', 'Feature planning'),
    'Pi: pi-livecraft Feature planning',
  )
  assert.equal(
    formatDocumentTitle('/Users/m.sawyer/workspaces/pi-livecraft', 'a'.repeat(35)),
    `Pi: pi-livecraft ${'a'.repeat(29)}…`,
  )
  assert.equal(formatDocumentTitle(''), 'Pi: Pi Livecraft')
})

test('choisit la session active suivante après une fermeture', () => {
  const recentSessions = [
    {
      id: 'closed',
      cwd: '/workspace',
      name: 'Closed',
      sessionPath: '/closed.jsonl',
      updatedAt: 30,
    },
    { id: 'next', cwd: '/workspace', name: 'Next', sessionPath: '/next.jsonl', updatedAt: 20 },
    {
      id: 'previous',
      cwd: '/workspace',
      name: 'Previous',
      sessionPath: '/previous.jsonl',
      updatedAt: 10,
    },
  ]
  const sessions = recentSessions.map((session) => ({
    ...session,
    status: 'idle' as const,
    pendingUi: [],
  }))
  assert.equal(nextActiveSessionId('closed', sessions, recentSessions, '/workspace'), 'next')
  assert.equal(nextActiveSessionId('next', sessions, recentSessions, '/workspace'), 'previous')
})
