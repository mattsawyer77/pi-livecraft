import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const extensionBundles = [
  'dist-runtime/extensions/ask-user-question.js',
  'dist-runtime/extensions/quotas.js',
]

test('bundles Livecraft Pi extensions without source-relative imports', async () => {
  for (const path of extensionBundles) {
    const source = await readFile(path, 'utf8')
    assert.equal(source.includes('../shared/'), false)
  }
})
