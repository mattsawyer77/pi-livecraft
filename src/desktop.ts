import type { DesktopBootstrap, DesktopBridge, DesktopPreferences } from '../desktop/shared.ts'
import { configureApi } from './api.ts'

/** Returns Electron's bootstrapped desktop state when the typed preload bridge is available. */
export async function loadDesktopBootstrap(): Promise<DesktopBootstrap | null> {
  const bridge = (globalThis as unknown as { piLivecraftDesktop?: DesktopBridge })
    .piLivecraftDesktop
  if (!bridge) return null
  const bootstrap = await bridge.getBootstrap()
  if (bootstrap.pi.ready) configureApi(bootstrap)
  return bootstrap
}

/** Keeps disk-backed settings authoritative while accepting the documented legacy browser fallback. */
export function mergeDesktopPreferences(
  preferences: DesktopPreferences,
  stored: Record<string, string | null>,
): DesktopPreferences {
  const selectedSessionId = stored['pi-livecraft.selected-session']
  if (preferences.selectedSessionId || !selectedSessionId?.trim()) return preferences
  return { ...preferences, selectedSessionId }
}

type DesktopPreferenceUpdate = Partial<
  Pick<
    DesktopPreferences,
    'piPath' | 'selectedSessionId' | 'tabs' | 'themePreferences' | 'uiPreferences' | 'window'
  >
>

/** Updates only the serializable desktop settings owned by the preload bridge. */
export function applyDesktopPreference(
  preferences: DesktopPreferences,
  update: DesktopPreferenceUpdate,
): DesktopPreferences {
  for (const key of Object.keys(update)) {
    if (
      !['piPath', 'selectedSessionId', 'tabs', 'themePreferences', 'uiPreferences', 'window']
        .includes(key)
    )
      throw new Error('Unknown desktop preference')
  }
  return {
    ...preferences,
    ...update,
    ...(update.uiPreferences
      ? { uiPreferences: { ...preferences.uiPreferences, ...update.uiPreferences } }
      : {}),
    version: 1,
  }
}
