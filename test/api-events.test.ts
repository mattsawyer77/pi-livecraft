import assert from 'node:assert/strict'
import test from 'node:test'
import { configureApi, listDirectories, parseManagerEvent } from '../src/api.ts'

test('parses a valid manager event', () => {
  const event = parseManagerEvent(JSON.stringify({
    kind: 'event',
    event: 'pi',
    sessionId: 'session-1',
    data: { type: 'agent_start' },
    sequence: 3,
  }))

  assert.deepEqual(event, {
    kind: 'event',
    event: 'pi',
    sessionId: 'session-1',
    data: { type: 'agent_start' },
    sequence: 3,
  })
  assert.deepEqual(
    parseManagerEvent(JSON.stringify({
      kind: 'event',
      event: 'session_reassigned',
      sessionId: 'session-1',
      data: { newSessionId: 'session-2' },
    })),
    {
      kind: 'event',
      event: 'session_reassigned',
      sessionId: 'session-1',
      data: { newSessionId: 'session-2' },
    },
  )
})

test('sends the desktop launch secret with directory requests', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })
  configureApi({ apiSecret: 'launch-secret', backendUrl: 'http://127.0.0.1:43121' })
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'http://127.0.0.1:43121/api/directories?path=%2Fworkspace')
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer launch-secret')
    return new Response(JSON.stringify({ directories: [], parentPath: null, path: '/workspace' }))
  }
  await listDirectories('/workspace')
})

test('rejects malformed or unknown manager events', () => {
  assert.equal(parseManagerEvent('{'), null)
  assert.equal(
    parseManagerEvent(JSON.stringify({ kind: 'response', event: 'pi', sessionId: 'session-1' })),
    null,
  )
  assert.equal(
    parseManagerEvent(JSON.stringify({ kind: 'event', event: 'unknown', sessionId: 'session-1' })),
    null,
  )
  assert.equal(
    parseManagerEvent(JSON
      .stringify({ kind: 'event', event: 'pi', sessionId: 'session-1', sequence: -1 })),
    null,
  )
})
