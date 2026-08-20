export interface DesktopTabState {
  sessionId: string
}

export interface DesktopWindowState {
  height: number
  width: number
  x?: number
  y?: number
}

export interface DesktopUiPreferences {
  conversationView?: 'simple' | 'semi-detailed' | 'detailed'
  recentWorkspacePaths?: readonly string[]
  rightSidebarWidth?: number
  selectedRightWidget?: 'analysis' | 'git' | 'quotas' | 'todo'
  shortcuts?: Record<string, string>
  terminalCommand?: string
  workspacePath?: string
  workspaceSidebarCollapsed?: boolean
  workspaceSidebarWidth?: number
}

export interface DesktopPreferences {
  piPath?: string
  selectedSessionId?: string
  themePreferences?: { active: string; themes: unknown[]; builtInOverrides?: unknown }
  uiPreferences?: DesktopUiPreferences
  tabs: DesktopTabState[]
  version: 1
  window?: DesktopWindowState
}

export interface DesktopBootstrap {
  apiSecret: string
  backendUrl: string
  desktop: true
  pi: { message?: string; path?: string; ready: boolean }
  preferences: DesktopPreferences
}

export interface DesktopBridge {
  getBootstrap(): Promise<DesktopBootstrap>
  savePreferences(preferences: DesktopPreferences): Promise<void>
}

declare global {
  interface Window {
    piLivecraftDesktop?: DesktopBridge
  }
}
