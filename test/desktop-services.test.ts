import assert from 'node:assert/strict'
import test from 'node:test'
import packageJson from '../package.json' with { type: 'json' }

test('defines Electron desktop build and package scripts', () => {
  assert.equal(typeof packageJson.scripts['desktop:typecheck'], 'string')
  assert.equal(typeof packageJson.scripts['desktop:package'], 'string')
})
