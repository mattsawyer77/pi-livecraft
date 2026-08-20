import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('bundles the manager and emits a packaged runtime manifest for it', () => {
  const build = readFileSync(new URL('../desktop/build-runtime.mjs', import.meta.url), 'utf8')
  assert.match(build, /\['server\/manager\.ts', 'dist-runtime\/manager\.js'\]/)
  assert.equal(build.includes('\'dist-runtime/manager-runtime-files.json\''), true)
})
