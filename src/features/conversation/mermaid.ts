export const mermaidFailureMessage = 'Mermaid could not be rendered.'

export function isMermaidCode(className?: string): boolean {
  return /(?:^|\s)language-mermaid(?:\s|$)/.test(className ?? '')
}

export function hasElkLayout(source: string): boolean {
  return /(?:^|\n)\s*layout\s*:\s*elk\s*(?:\n|$)/.test(source)
}

export function mermaidRenderConfig(theme: 'dark' | 'default'): {
  securityLevel: 'strict'
  startOnLoad: false
  theme: 'dark' | 'default'
} {
  return {
    securityLevel: 'strict',
    startOnLoad: false,
    theme,
  }
}
