import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { discoverPi } from './pi-discovery.ts'
import {
  createDesktopServices,
  packagedDistDirectory,
  packagedRuntimeEntries,
  type DesktopServices,
} from './services.ts'
import { createDesktopSettingsStore } from './settings.ts'
import type { DesktopBootstrap, DesktopPreferences } from './shared.ts'

let services: DesktopServices | undefined
let stopping: Promise<void> | undefined

app.setName('Pi Livecraft')

void app
  .whenReady()
  .then(async () => {
    const store = createDesktopSettingsStore(app.getPath('userData'))
    const preferences = await store.load()
    const pi = await discoverPi({ configuredPath: preferences.piPath })
    let bootstrap: DesktopBootstrap = {
      apiSecret: '',
      backendUrl: '',
      desktop: true,
      pi,
      preferences,
    }

    if (pi.ready && pi.path) {
      const resourceRoot = app.isPackaged
        ? process.resourcesPath
        : fileURLToPath(new URL('..', import.meta.url))
      const entries = app.isPackaged
        ? packagedRuntimeEntries(resourceRoot)
        : {
          backendEntry: resolve(resourceRoot, 'dist-runtime', 'backend.js'),
          managerEntry: resolve(resourceRoot, 'dist-runtime', 'manager-supervisor.js'),
        }
      services = createDesktopServices({
        ...entries,
        distDirectory: app.isPackaged
          ? packagedDistDirectory(resourceRoot)
          : resolve(resourceRoot, 'dist'),
        piPath: pi.path,
        extensionsDirectory: app.isPackaged
          ? resolve(resourceRoot, 'app.asar.unpacked', 'dist-runtime', 'extensions')
          : resolve(resourceRoot, 'dist-runtime', 'extensions'),
        runtimeRoot: app.isPackaged
          ? resolve(resourceRoot, 'app.asar.unpacked')
          : resourceRoot,
      })
      try {
        await services.start()
        bootstrap = {
          ...bootstrap,
          apiSecret: services.runtime.apiSecret,
          backendUrl: `http://127.0.0.1:${services.runtime.backendPort}`,
        }
      } catch (error) {
        bootstrap = {
          ...bootstrap,
          pi: { message: safeError(error), ready: false },
        }
        services = undefined
      }
    }

    ipcMain.handle('pi-livecraft:get-bootstrap', () => bootstrap)
    ipcMain.handle('pi-livecraft:save-preferences', async (_event, next: DesktopPreferences) => {
      await store.save(next)
      bootstrap = { ...bootstrap, preferences: await store.load() }
    })

    const window = new BrowserWindow({
      height: preferences.window?.height ?? 900,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: resolve(resourceRootForPreload(), 'dist-desktop', 'preload.js'),
      },
      width: preferences.window?.width ?? 1_400,
      x: preferences.window?.x,
      y: preferences.window?.y,
    })
    configureNavigation(window, bootstrap.backendUrl)
    window.on('close', () => {
      const bounds = window.getBounds()
      void store.save({ ...bootstrap.preferences, window: bounds })
    })

    if (bootstrap.pi.ready) await window.loadURL(bootstrap.backendUrl)
    else await window.loadFile(resolve(resourceRootForPreload(), 'dist', 'index.html'))
  })
  .catch((error: unknown) => {
    console.error(error)
    app.exit(1)
  })

app.on('before-quit', (event) => {
  if (!services || stopping) return
  event.preventDefault()
  stopping = services.stop().finally(() => {
    services = undefined
    app.quit()
  })
})

function resourceRootForPreload(): string {
  return app.isPackaged
    ? resolve(process.resourcesPath, 'app.asar')
    : fileURLToPath(new URL('..', import.meta.url))
}

function configureNavigation(window: BrowserWindow, backendUrl: string): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalHttps(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (backendUrl && url.startsWith(backendUrl)) return
    event.preventDefault()
    void openExternalHttps(url)
  })
}

async function openExternalHttps(value: string): Promise<void> {
  try {
    if (new URL(value).protocol === 'https:') await shell.openExternal(value)
  } catch {
    // Ignore malformed external navigation attempts.
  }
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Livecraft local services could not start.'
}
