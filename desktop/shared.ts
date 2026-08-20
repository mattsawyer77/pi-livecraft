export interface DesktopTabState {
  sessionId: string
}

export interface DesktopWindowState {
  height: number
  width: number
  x?: number
  y?: number
}

export interface DesktopPreferences {
  piPath?: string
  selectedSessionId?: string
  themePreferences?: { active: string; themes: unknown[]; builtInOverrides?: unknown }
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
