import assert from 'node:assert/strict'
import test from 'node:test'
import {
  reconcileSessionTabs,
  selectAfterTabClose,
} from '../src/features/workspace/session-tabs.ts'

const sessions = [
  {
    id: 'a',
    cwd: '/a',
    name: 'Build app',
    pendingUi: [],
    sessionPath: '/a.jsonl',
    status: 'running' as const,
  },
  {
    id: 'b',
    cwd: '/b',
    name: 'Review code',
    pendingUi: [],
    sessionPath: '/b.jsonl',
    status: 'idle' as const,
  },
]

test('restores live persisted tabs and includes the selected live session', () => {
  assert.deepEqual(reconcileSessionTabs([{ sessionId: 'b' }], sessions, 'a'), [
    { id: 'b', running: false, title: 'Review code' },
    { id: 'a', running: true, title: 'Build app' },
  ])
})

test('selects the adjacent visible tab after closing the selected tab', () => {
  const tabs = [
    { id: 'a', running: true, title: 'A' },
    { id: 'b', running: false, title: 'B' },
    { id: 'c', running: false, title: 'C' },
  ]
  assert.equal(selectAfterTabClose('b', tabs, 'b'), 'c')
  assert.equal(selectAfterTabClose('a', tabs, 'a'), 'b')
  assert.equal(selectAfterTabClose('b', tabs, 'a'), 'a')
})
