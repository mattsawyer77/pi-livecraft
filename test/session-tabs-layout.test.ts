import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const base = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8')
const tabs = readFileSync(
  new URL('../src/features/workspace/session-tabs.css', import.meta.url),
  'utf8',
)

test('gives desktop tabs their own visible grid row above the conversation', () => {
  assert.match(
    base,
    /\.workspace\.has-session-tabs\s*\{\s*grid-template-rows:\s*auto minmax\(0, 1fr\) auto;/,
  )
  assert.match(tabs, /position:\s*relative;/)
  assert.match(tabs, /z-index:\s*4;/)
  assert.match(tabs, /min-height:\s*48px;/)
})
