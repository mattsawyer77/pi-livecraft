import { app } from 'electron'

app.whenReady().catch((error: unknown) => {
  console.error(error)
  app.exit(1)
})
