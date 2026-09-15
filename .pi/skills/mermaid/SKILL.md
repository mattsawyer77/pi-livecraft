---
name: mermaid
description: Use when presenting diagrams in Markdown responses or documents.
---

# Mermaid diagrams

- Use an explicit `mermaid` fenced block.
- Embed the fence in explanatory Markdown when useful.
- Keep diagrams valid and reasonably scoped; split very large diagrams when that improves readability.
- For dense or highly connected flowcharts, request ELK with frontmatter:

  ```mermaid
  ---
  config:
    layout: elk
  ---
  flowchart TD
    A --> B
  ```

- Use ELK when it improves readability; not every Mermaid diagram type supports every layout.
