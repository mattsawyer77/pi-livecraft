import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasElkLayout,
  isMermaidCode,
  mermaidDiagramWidth,
  mermaidFailureMessage,
  mermaidRenderConfig,
  mermaidRenderFallbackVisible,
  mermaidRenderState,
} from '../src/features/conversation/mermaid.ts'

test('recognizes only an explicit mermaid language class', () => {
  assert.equal(isMermaidCode('language-mermaid'), true)
  assert.equal(isMermaidCode('foo language-mermaid bar'), true)
  assert.equal(isMermaidCode('language-Mermaid'), false)
  assert.equal(isMermaidCode('language-flowchart'), false)
  assert.equal(isMermaidCode(undefined), false)
})

test('detects explicit ELK layout requests', () => {
  assert.equal(hasElkLayout('---\nconfig:\n  layout: elk\n---\nflowchart TD\nA --> B'), true)
  assert.equal(hasElkLayout('flowchart-elk TD\nA --> B'), true)
  assert.equal(hasElkLayout('flowchart TD\nA --> B'), false)
  assert.equal(hasElkLayout('flowchart TD\nA --> elk'), false)
})

test('keeps the source fallback visible until direct rendering succeeds', () => {
  assert.equal(mermaidRenderFallbackVisible('loading'), true)
  assert.equal(mermaidRenderFallbackVisible('error'), true)
  assert.equal(mermaidRenderFallbackVisible('rendered'), false)
})

test('keeps a successful render state separate from the fallback state', () => {
  assert.equal(mermaidRenderState(undefined, undefined), 'loading')
  assert.equal(mermaidRenderState(undefined, new Error('invalid')), 'error')
  assert.equal(mermaidRenderState('<svg></svg>', undefined), 'rendered')
})

test('preserves readable intrinsic width for rendered diagrams', () => {
  assert.equal(mermaidDiagramWidth('<svg viewBox="0 0 1200 800"></svg>'), 1200)
  assert.equal(mermaidDiagramWidth('<svg viewBox="0 0 400 300"></svg>'), 640)
  assert.equal(mermaidDiagramWidth('<svg></svg>'), 640)
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
