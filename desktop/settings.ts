import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  DesktopPreferences,
  DesktopTabState,
  DesktopUiPreferences,
  DesktopWindowState,
} from './shared.ts'

const SETTINGS_FILE = 'settings.json'

export interface DesktopSettingsStore {
  load(): Promise<DesktopPreferences>
  save(preferences: DesktopPreferences): Promise<void>
}

const defaultPreferences = (): DesktopPreferences => ({ tabs: [], version: 1 })

/** Stores the desktop-only durable settings in Electron's platform user-data directory. */
export function createDesktopSettingsStore(userDataPath: string): DesktopSettingsStore {
  const settingsPath = join(userDataPath, SETTINGS_FILE)
  let saveQueue = Promise.resolve()

  return {
    async load(): Promise<DesktopPreferences> {
      try {
        return parsePreferences(JSON.parse(await readFile(settingsPath, 'utf8')))
      } catch {
        return defaultPreferences()
      }
    },

    async save(preferences: DesktopPreferences): Promise<void> {
      const write = async (): Promise<void> => {
        const current = await readExistingPreferences(settingsPath)
        const serialized = serializePreferences(mergePreferences(current, preferences))
        const temporaryPath = `${settingsPath}.${process.pid}.${randomUUID()}.tmp`
        await mkdir(userDataPath, { mode: 0o700, recursive: true })
        await writeFile(temporaryPath, `${JSON.stringify(serialized, null, 2)}\n`, { mode: 0o600 })
        await rename(temporaryPath, settingsPath)
      }
      const pending = saveQueue.then(write, write)
      saveQueue = pending.catch(() => undefined)
      await pending
    },
  }
}

/** Imports only the documented selected-session browser fallback into absent disk preferences. */
export function migrateBrowserPreferences(
  stored: Record<string, string | null>,
  preferences: DesktopPreferences,
): DesktopPreferences {
  const selectedSessionId = stored['pi-livecraft.selected-session']
  if (preferences.selectedSessionId || !selectedSessionId?.trim()) return preferences
  return { ...preferences, selectedSessionId }
}

async function readExistingPreferences(settingsPath: string): Promise<DesktopPreferences> {
  try {
    return parsePreferences(JSON.parse(await readFile(settingsPath, 'utf8')))
  } catch {
    return defaultPreferences()
  }
}

function mergePreferences(
  current: DesktopPreferences,
  update: DesktopPreferences,
): DesktopPreferences {
  return {
    ...current,
    ...update,
    themePreferences: update.themePreferences ?? current.themePreferences,
    ...(Object.keys({ ...current.uiPreferences, ...update.uiPreferences }).length > 0
      ? { uiPreferences: { ...current.uiPreferences, ...update.uiPreferences } }
      : {}),
    window: update.window ?? current.window,
  }
}

function parsePreferences(value: unknown): DesktopPreferences {
  if (!isRecord(value) || value.version !== 1 || !isTabs(value.tabs)) return defaultPreferences()
  if (value.piPath !== undefined && typeof value.piPath !== 'string') return defaultPreferences()
  if (value.selectedSessionId !== undefined && typeof value.selectedSessionId !== 'string')
    return defaultPreferences()
  if (value.themePreferences !== undefined && !isThemePreferences(value.themePreferences))
    return defaultPreferences()
  if (value.uiPreferences !== undefined && !isUiPreferences(value.uiPreferences))
    return defaultPreferences()
  if (value.window !== undefined && !isWindowState(value.window)) return defaultPreferences()

  return {
    ...(typeof value.piPath === 'string' ? { piPath: value.piPath } : {}),
    ...(typeof value.selectedSessionId === 'string'
      ? { selectedSessionId: value.selectedSessionId }
      : {}),
    ...(isThemePreferences(value.themePreferences)
      ? { themePreferences: value.themePreferences }
      : {}),
    ...(isUiPreferences(value.uiPreferences) ? { uiPreferences: value.uiPreferences } : {}),
    tabs: value.tabs,
    version: 1,
    ...(isWindowState(value.window) ? { window: value.window } : {}),
  }
}

function serializePreferences(preferences: DesktopPreferences): DesktopPreferences {
  return {
    ...(typeof preferences.piPath === 'string' ? { piPath: preferences.piPath } : {}),
    ...(typeof preferences.selectedSessionId === 'string'
      ? { selectedSessionId: preferences.selectedSessionId }
      : {}),
    ...(isThemePreferences(preferences.themePreferences)
      ? { themePreferences: preferences.themePreferences }
      : {}),
    ...(isUiPreferences(preferences.uiPreferences)
      ? { uiPreferences: preferences.uiPreferences }
      : {}),
    tabs: preferences.tabs.map(({ sessionId }) => ({ sessionId })),
    version: 1,
    ...(isWindowState(preferences.window) ? { window: preferences.window } : {}),
  }
}

function isUiPreferences(value: unknown): value is DesktopUiPreferences {
  if (!isRecord(value)) return false
  const string = (field: string) => value[field] === undefined || typeof value[field] === 'string'
  const number = (field: string) => value[field] === undefined || Number.isFinite(value[field])
  const strings = (field: string) =>
    value[field] === undefined
    || (Array.isArray(value[field]) && value[field].every((item) => typeof item === 'string'))
  const shortcuts = value.shortcuts === undefined || (isRecord(value.shortcuts)
    && Object.values(value.shortcuts).every((shortcut) => typeof shortcut === 'string'))
  return string('conversationView') && strings('recentWorkspacePaths')
    && number('rightSidebarWidth')
    && string('selectedRightWidget') && shortcuts && string('terminalCommand')
    && string('workspacePath') && (value.workspaceSidebarCollapsed === undefined
      || typeof value.workspaceSidebarCollapsed === 'boolean')
    && number('workspaceSidebarWidth')
}

function isThemePreferences(
  value: unknown,
): value is NonNullable<DesktopPreferences['themePreferences']> {
  return isRecord(value) && typeof value.active === 'string' && Array.isArray(value.themes)
}

function isTabs(value: unknown): value is DesktopTabState[] {
  return Array.isArray(value)
    && value.every((tab) => isRecord(tab) && typeof tab.sessionId === 'string')
}

function isWindowState(value: unknown): value is DesktopWindowState {
  if (!isRecord(value) || !Number.isFinite(value.height) || !Number.isFinite(value.width))
    return false
  return (value.x === undefined || Number.isFinite(value.x))
    && (value.y === undefined || Number.isFinite(value.y))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
