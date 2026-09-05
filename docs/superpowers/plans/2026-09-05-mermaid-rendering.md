# Mermaid Markdown Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render explicit Mermaid fences as safe, responsive SVG diagrams across Livecraft's shared Markdown surfaces, with optional ELK layout and source-preserving fallback.

**Architecture:** Extend `src/features/conversation/Markdown.tsx` at its existing `ReactMarkdown` code boundary. A dedicated lazy-loaded `MermaidDiagram` component will render Mermaid to SVG, use ELK only when requested, and fall back to the existing source-code presentation on failure. A project skill under `.pi/skills/mermaid/` will teach Pi how to emit explicit Mermaid fences and request ELK appropriately.

**Tech Stack:** React 19, TypeScript, `react-markdown`, Mermaid, `@mermaid-js/layout-elk`, Vite, Node's built-in test runner, dprint, Oxlint.

## Global Constraints

- Recognize only explicit fenced code blocks marked `language-mermaid`.
- Render static responsive SVGs; do not add pan, zoom, or node interactions.
- Use restrictive Mermaid security settings and never inject source text as HTML.
- Preserve source in a normal code block when rendering fails.
- Keep all Markdown surfaces on the shared `Markdown` boundary.
- Load Mermaid and ELK lazily so ordinary Markdown does not pay the initial diagram bundle cost.
- Do not modify unrelated pre-existing files: `.pi-livecraft-tabspaces-session.el`, `macos-crash-report.txt`, `pnpm-lock.yaml`, or `pnpm-workspace.yaml`.

---

### Task 1: Add pure Mermaid fence and configuration helpers

**Files:**
- Create: `src/features/conversation/mermaid.ts`
- Create: `test/mermaid.test.ts`

**Interfaces:**
- Produces `isMermaidCode(className?: string): boolean` for the Markdown renderer.
- Produces `mermaidRenderConfig(theme: 'dark' | 'default'): object` for the browser renderer.
- Produces `hasElkLayout(source: string): boolean` for deciding whether to load/register ELK.

- [ ] **Step 1: Write failing tests**

Create `test/mermaid.test.ts` using `node:test` and `node:assert/strict`. Cover exact Mermaid class recognition, non-Mermaid classes, ELK frontmatter detection, and restrictive render configuration:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { hasElkLayout, isMermaidCode, mermaidRenderConfig } from '../src/features/conversation/mermaid.ts'

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

test('uses restrictive Mermaid rendering settings', () => {
  assert.deepEqual(mermaidRenderConfig('dark'), {
    securityLevel: 'strict',
    startOnLoad: false,
    theme: 'dark',
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test test/mermaid.test.ts`

Expected: FAIL because `src/features/conversation/mermaid.ts` does not exist.

- [ ] **Step 3: Implement the minimal helpers**

Implement class-token matching with a case-sensitive regular expression, detect only a YAML/frontmatter or Mermaid config layout value set to `elk`, and return a typed restrictive Mermaid config object. Keep parsing deliberately narrow; do not infer ELK from arbitrary diagram content.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test test/mermaid.test.ts`

Expected: PASS.

- [ ] **Step 5: Run formatting on the new files**

Run: `npx dprint fmt src/features/conversation/mermaid.ts test/mermaid.test.ts`

Expected: files formatted without changing the tested behavior.

---

### Task 2: Add the Mermaid browser renderer and source fallback

**Files:**
- Create: `src/features/conversation/MermaidDiagram.tsx`
- Modify: `src/features/conversation/conversation.css`
- Modify: `src/features/conversation/Markdown.tsx`

**Interfaces:**
- `MermaidDiagram` accepts `{ source: string; copyablePre?: boolean; onError?: (cause: unknown) => void }`.
- It renders a static SVG on success and a source `<pre><code>` fallback with an accessible compact error label on failure.
- `MarkdownCode` remains responsible for non-Mermaid code blocks.

- [ ] **Step 1: Write the failing integration test or test seam**

Extend `test/mermaid.test.ts` with assertions for the pure fallback helper exported from `mermaid.ts`:

```ts
import { mermaidFailureMessage } from '../src/features/conversation/mermaid.ts'

test('uses a compact stable failure message', () => {
  assert.equal(mermaidFailureMessage, 'Mermaid could not be rendered.')
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test test/mermaid.test.ts`

Expected: FAIL because `mermaidFailureMessage` is not exported.

- [ ] **Step 3: Implement the component and Markdown routing**

Implement `MermaidDiagram.tsx` with these exact behaviors:

- Use a module-level lazy import for Mermaid and the ELK layout package.
- Initialize Mermaid with `mermaidRenderConfig(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default')`.
- Register ELK only when `hasElkLayout(source)` is true, using the installed package's current public API verified during dependency setup.
- Generate a per-instance ID with `useId`, normalized to Mermaid-safe characters.
- Render with Mermaid's public `render(id, source)` API inside an effect, canceling stale results on unmount or source changes.
- Put the returned SVG into a wrapper using React's controlled HTML insertion only for Mermaid's generated SVG.
- On any rejection or render exception, set an error state, call `onError` if provided, and show the source in a normal `<pre><code>` block with the compact failure message.
- While loading or rendering, show the source code rather than an empty area.
- Keep `copyablePre` behavior by reusing `CopyablePre` when requested.

In `Markdown.tsx`, route `language-mermaid` code nodes to `MermaidDiagram`; pass the existing `copyablePre` and `onError` props. Keep all other code nodes on `MarkdownCode` and preserve frontmatter behavior.

Add colocated styles in `conversation.css` for a responsive SVG wrapper, `max-width: 100%`, safe overflow behavior, and a compact error label using existing theme variables. Do not add gradients, decorative cards, or interactive controls.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `node --test test/mermaid.test.ts && npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Format and lint touched files**

Run: `npx dprint fmt src/features/conversation/MermaidDiagram.tsx src/features/conversation/Markdown.tsx src/features/conversation/mermaid.ts src/features/conversation/conversation.css test/mermaid.test.ts && npm run lint`

Expected: formatting and lint pass.

---

### Task 3: Add Mermaid and ELK dependencies and agent guidance

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `.pi/skills/mermaid/SKILL.md`

**Interfaces:**
- Browser code imports Mermaid and the public ELK integration from the declared package versions.
- The skill is agent-facing guidance only and does not replace renderer validation.

- [ ] **Step 1: Confirm package metadata before installation**

Run: `npm view mermaid version peerDependencies --json && npm view @mermaid-js/layout-elk version peerDependencies --json`

Expected: current package metadata is available. Select mutually compatible versions and verify the package's documented public ELK registration API before editing imports.

- [ ] **Step 2: Install the dependencies**

Run: `npm install mermaid @mermaid-js/layout-elk`

Expected: `package.json` and `package-lock.json` change only to add the two runtime dependencies and their resolved transitive packages.

- [ ] **Step 3: Write the agent skill**

Create `.pi/skills/mermaid/SKILL.md` with frontmatter and concise instructions:

```md
---
name: mermaid
description: Use when presenting diagrams in Markdown responses or Markdown documents.
---

# Mermaid diagrams

- Put diagrams in explicit fenced Markdown blocks beginning with `mermaid`.
- Embed Mermaid fences inside explanatory Markdown when prose or headings help the reader.
- Prefer valid, reasonably scoped diagrams and split very large diagrams when that improves readability.
- For dense, hierarchical, or heavily connected diagrams, request the open-source ELK layout with Mermaid config frontmatter:

  ```mermaid
  ---
  config:
    layout: elk
  ---
  flowchart TD
    A --> B
  ```

- Use ELK only when it improves readability; not every Mermaid diagram type supports every layout.
- Do not assume Mermaid rendering is available outside the current Markdown renderer.
```

- [ ] **Step 4: Run typecheck and inspect dependency changes**

Run: `npm run typecheck && git diff -- package.json package-lock.json .pi/skills/mermaid/SKILL.md`

Expected: typecheck passes; diff contains no unrelated dependency or configuration edits.

---

### Task 4: Validate all acceptance criteria and finish

**Files:**
- Modify only files already listed above if validation exposes a defect.

- [ ] **Step 1: Run the complete focused test set**

Run: `node --test test/mermaid.test.ts test/message-display.test.ts test/conversation-scroll.test.ts`

Expected: all tests pass.

- [ ] **Step 2: Run repository validation**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run build`

Expected: all commands pass.

- [ ] **Step 3: Review the final diff and status**

Run: `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null git diff --check && GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null git status --short && GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null git diff --stat`

Expected: only Mermaid implementation files plus the already-staged design spec are changed; unrelated pre-existing untracked files remain untouched.

- [ ] **Step 4: Commit task files if Git identity is available**

Run: `git add package.json package-lock.json .pi/skills/mermaid src/features/conversation/Markdown.tsx src/features/conversation/MermaidDiagram.tsx src/features/conversation/mermaid.ts src/features/conversation/conversation.css test/mermaid.test.ts && git commit -m '✨ Render Mermaid diagrams in Markdown'`

Expected: one task-only commit. If Git author identity remains unavailable, report that blocker without changing Git configuration.
