import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopBridge, DesktopBootstrap } from './shared.ts'

const bridge: DesktopBridge = {
  getBootstrap: () => ipcRenderer.invoke('pi-livecraft:get-bootstrap') as Promise<DesktopBootstrap>,
  savePreferences: (preferences) =>
    ipcRenderer.invoke('pi-livecraft:save-preferences', preferences) as Promise<void>,
}

contextBridge.exposeInMainWorld('piLivecraftDesktop', bridge)
