import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadDesktopBootstrap } from './desktop.ts'

const desktopBootstrap = await loadDesktopBootstrap()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App desktopBootstrap={desktopBootstrap} />
  </StrictMode>,
)
