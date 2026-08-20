import assert from 'node:assert/strict'
import test from 'node:test'
import packageJson from '../package.json' with { type: 'json' }
import { createLocalRuntime } from '../desktop/services.ts'

test('defines Electron desktop build and package scripts', () => {
  assert.equal(typeof packageJson.scripts['desktop:typecheck'], 'string')
  assert.equal(typeof packageJson.scripts['desktop:package'], 'string')
})

test('creates unique loopback runtime values and does not persist its secret', async () => {
  const first = await createLocalRuntime()
  const second = await createLocalRuntime()
  assert.notEqual(first.apiSecret, second.apiSecret)
  assert.notEqual(first.backendPort, first.managerPort)
  assert.match(first.apiSecret, /^[A-Za-z0-9_-]{43}$/)
})
