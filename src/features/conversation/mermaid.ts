export const mermaidFailureMessage = 'Mermaid could not be rendered.'
export function mermaidRenderFallbackVisible(state: 'loading' | 'error' | 'rendered'): boolean {
  return state !== 'rendered'
}

export function mermaidRenderState(
  svg: string | undefined,
  error: unknown,
): 'loading' | 'error' | 'rendered' {
  if (error) return 'error'
  return svg ? 'rendered' : 'loading'
}

export function mermaidDiagramWidth(svg: string): number {
  const viewBoxWidth = /\bviewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([-\d.]+)/.exec(svg)?.[1]
  const intrinsicWidth = viewBoxWidth ? Number(viewBoxWidth) : 0
  return Math.max(640, Math.ceil(intrinsicWidth))
}

export function isMermaidCode(className?: string): boolean {
  return /(?:^|\s)language-mermaid(?:\s|$)/.test(className ?? '')
}

export function hasElkLayout(source: string): boolean {
  return /(?:^|\n)\s*layout\s*:\s*elk\s*(?:\n|$)/.test(source)
    || /^\s*flowchart-elk\b/m.test(source)
}

export function mermaidRenderConfig(theme: 'dark' | 'default'): {
  securityLevel: 'strict'
  startOnLoad: false
  suppressErrorRendering: true
  theme: 'dark' | 'default'
} {
  return {
    securityLevel: 'strict',
    startOnLoad: false,
    suppressErrorRendering: true,
    theme,
  }
}
