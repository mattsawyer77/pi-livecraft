import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasElkLayout,
  isMermaidCode,
  mermaidFailureMessage,
  mermaidRenderConfig,
} from '../src/features/conversation/mermaid.ts'

test('recognizes only an explicit mermaid language class', () => {
  assert.equal(isMermaidCode('language-mermaid'), true)
  assert.equal(isMermaidCode('foo language-mermaid bar'), true)
  assert.equal(isMermaidCode('language-Mermaid'), false)
  assert.equal(isMermaidCode('language-flowchart'), false)
  assert.equal(isMermaidCode(undefined), false)
})

test('detects ELK layout in Mermaid frontmatter or config', () => {
  assert.equal(hasElkLayout('---\nconfig:\n  layout: elk\n---\nflowchart TD\nA --> B'), true)
  assert.equal(hasElkLayout('flowchart TD\nA --> B'), false)
  assert.equal(hasElkLayout('flowchart TD\nA --> elk'), false)
})

test('uses a compact stable failure message', () => {
  assert.equal(mermaidFailureMessage, 'Mermaid could not be rendered.')
})

test('uses restrictive Mermaid rendering settings', () => {
  assert.deepEqual(mermaidRenderConfig('dark'), {
    securityLevel: 'strict',
    startOnLoad: false,
    suppressErrorRendering: true,
    theme: 'dark',
  })
})
