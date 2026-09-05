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
