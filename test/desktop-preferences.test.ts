import assert from 'node:assert/strict'
import test from 'node:test'
import { applyDesktopPreference } from '../src/desktop.ts'

test('updates only declared desktop preference keys', () => {
  assert.deepEqual(
    applyDesktopPreference({ tabs: [], version: 1 }, { piPath: '/usr/local/bin/pi' }),
    { piPath: '/usr/local/bin/pi', tabs: [], version: 1 },
  )
})

test('updates declared portable UI preferences', () => {
  assert.deepEqual(
    applyDesktopPreference({ tabs: [], version: 1 }, {
      uiPreferences: { conversationView: 'detailed', workspacePath: '/workspace' },
    }),
    {
      tabs: [],
      uiPreferences: { conversationView: 'detailed', workspacePath: '/workspace' },
      version: 1,
    },
  )
})

test('merges a desktop UI preference update with existing values', () => {
  assert.deepEqual(
    applyDesktopPreference(
      { tabs: [], uiPreferences: { workspacePath: '/workspace' }, version: 1 },
      { uiPreferences: { conversationView: 'detailed' } },
    ),
    {
      tabs: [],
      uiPreferences: { conversationView: 'detailed', workspacePath: '/workspace' },
      version: 1,
    },
  )
})

test('rejects a secret-shaped preference update', () => {
  assert.throws(
    () => applyDesktopPreference({ tabs: [], version: 1 }, { apiSecret: 'nope' } as never),
    /Unknown desktop preference/,
  )
})
