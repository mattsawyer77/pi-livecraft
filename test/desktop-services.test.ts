import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import packageJson from '../package.json' with { type: 'json' }
import { createLocalRuntime } from '../desktop/services.ts'

test('defines Electron desktop build and package scripts', () => {
  assert.equal(typeof packageJson.scripts['desktop:typecheck'], 'string')
  assert.equal(typeof packageJson.scripts['desktop:package'], 'string')
})

test('keeps Electron entrypoints external to avoid dynamic CommonJS requires', () => {
  const build = readFileSync(new URL('../desktop/build-runtime.mjs', import.meta.url), 'utf8')
  assert.match(build, /\['electron'\]/)
})

test('desktop builder excludes Pi and includes executable Livecraft runtime directories', () => {
  const config = readFileSync(new URL('../desktop/electron-builder.yml', import.meta.url), 'utf8')
  assert.match(config, /- dist-runtime\/\*\*/)
  assert.match(config, /- pi-extensions\/\*\*/)
  assert.match(config, /asarUnpack:/)
  assert.equal(config.includes('pi-coding-agent'), false)
})

test('creates unique loopback runtime values and does not persist its secret', async () => {
  const first = await createLocalRuntime()
  const second = await createLocalRuntime()
  assert.notEqual(first.apiSecret, second.apiSecret)
  assert.notEqual(first.backendPort, first.managerPort)
  assert.match(first.apiSecret, /^[A-Za-z0-9_-]{43}$/)
})
