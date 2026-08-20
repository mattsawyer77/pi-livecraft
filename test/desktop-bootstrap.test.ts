import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeDesktopPreferences } from '../src/desktop.ts'

test('keeps desktop values authoritative while importing absent browser fallback values', () => {
  assert.deepEqual(
    mergeDesktopPreferences(
      { selectedSessionId: 'disk', tabs: [{ sessionId: 'disk' }], version: 1 },
      { 'pi-livecraft.selected-session': 'browser' },
    ),
    { selectedSessionId: 'disk', tabs: [{ sessionId: 'disk' }], version: 1 },
  )
})
