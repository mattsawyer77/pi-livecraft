import { useEffect, useId, useState, type CSSProperties } from 'react'
import { CopyablePre } from './CodeBlock.tsx'
import {
  hasElkLayout,
  mermaidDiagramWidth,
  mermaidFailureMessage,
  mermaidRenderConfig,
} from './mermaid.ts'

type MermaidModule = typeof import('mermaid')
type MermaidInstance = MermaidModule['default']

type MermaidDiagramProps = {
  source: string
  copyablePre?: boolean
  onError?: (cause: unknown) => void
}

let mermaidPromise: Promise<MermaidInstance> | undefined
let elkPromise: Promise<typeof import('@mermaid-js/layout-elk').default> | undefined
let configuredTheme: 'dark' | 'default' | undefined
let elkRegistered = false

function loadMermaid(): Promise<MermaidInstance> {
  mermaidPromise ??= import('mermaid').then(({ default: mermaid }) => mermaid)
  return mermaidPromise
}

async function loadMermaidWithLayout(
  source: string,
  theme: 'dark' | 'default',
): Promise<MermaidInstance> {
  const mermaid = await loadMermaid()
  if (configuredTheme !== theme) {
    mermaid.initialize(mermaidRenderConfig(theme))
    configuredTheme = theme
  }
  if (hasElkLayout(source) && !elkRegistered) {
    elkPromise ??= import('@mermaid-js/layout-elk').then(({ default: layouts }) => layouts)
    mermaid.registerLayoutLoaders(await elkPromise)
    elkRegistered = true
  }
  return mermaid
}

function renderId(id: string): string {
  return `mermaid-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`
}

function currentTheme(): 'dark' | 'default' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default'
}

export function MermaidDiagram({ onError, copyablePre = false, source }: MermaidDiagramProps) {
  const id = useId()
  const [theme, setTheme] = useState<'dark' | 'default'>(currentTheme)
  const [svg, setSvg] = useState<string>()
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => setTheme(currentTheme()))
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    setSvg(undefined)
    setError(undefined)

    void loadMermaidWithLayout(source, theme)
      .then((mermaid) => mermaid.render(renderId(id), source))
      .then(({ svg: renderedSvg }) => {
        if (!cancelled) setSvg(renderedSvg)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(cause)
      })

    return () => {
      cancelled = true
    }
  }, [id, onError, source, theme])

  const sourceCode = <code className='language-mermaid'>{source}</code>
  if (!svg || error) {
    const fallback = copyablePre
      ? <CopyablePre onError={onError}>{sourceCode}</CopyablePre>
      : <pre>{sourceCode}</pre>
    return (
      <div className='mermaid-fallback'>
        {fallback}
        {Boolean(error) && <small role='status'>{mermaidFailureMessage}</small>}
      </div>
    )
  }

  return (
    <div
      className='mermaid-diagram'
      style={{ '--mermaid-diagram-width': `${mermaidDiagramWidth(svg)}px` } as CSSProperties}
    >
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}
