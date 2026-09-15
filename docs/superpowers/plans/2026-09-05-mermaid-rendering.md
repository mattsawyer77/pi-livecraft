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

### Task 1: Add Mermaid helpers and tests

**Files:**
- Create: `src/features/conversation/mermaid.ts`
- Create: `test/mermaid.test.ts`

Add pure helpers for explicit `language-mermaid` detection, ELK request detection (`layout: elk` and `flowchart-elk`), responsive intrinsic-width extraction, restrictive Mermaid configuration, and the stable failure message. Use Node's built-in test runner and verify the focused tests fail before implementation and pass afterward.

### Task 2: Add shared Markdown rendering

**Files:**
- Create: `src/features/conversation/MermaidDiagram.tsx`
- Modify: `src/features/conversation/Markdown.tsx`
- Modify: `src/features/conversation/conversation.css`

Route only `language-mermaid` blocks from the shared `ReactMarkdown` renderer to `MermaidDiagram`. Lazy-load Mermaid and `@mermaid-js/layout-elk`; register ELK only for explicit ELK requests. Initialize Mermaid with strict security, `suppressErrorRendering`, theme selection, and SVG labels (`htmlLabels: false`) so flowchart measurement is reliable.

Mount one visible `.mermaid-diagram` target and pass it to Mermaid's `render(id, source, target)` API. Insert Mermaid's returned SVG into that same target because Mermaid removes its temporary render child before resolving. Keep the target mounted while the source fallback is shown; hide the fallback after success, and clear the target plus show the source/error message on failure. Preserve copyable source behavior and intrinsic-width horizontal overflow.

### Task 3: Add dependencies and agent guidance

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `.pi/skills/mermaid/SKILL.md`

Add compatible Mermaid and ELK runtime dependencies. Keep the skill concise: use explicit Mermaid fences, embed them in explanatory Markdown, use valid reasonably scoped diagrams, and request ELK for dense flowcharts when useful.

### Task 4: Validate and finish

Run the focused Mermaid tests, then:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
```

Review the changed implementation and documentation, confirm unrelated pre-existing files are untouched, and commit only the Mermaid-related files. If formatting cannot run because the dprint plugin is unavailable, report that limitation rather than changing formatter configuration.
