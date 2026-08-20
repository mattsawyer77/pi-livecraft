import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createDesktopSettingsStore, migrateBrowserPreferences } from '../desktop/settings.ts'

test('writes versioned desktop preferences without launch secrets', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pi-livecraft-settings-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const store = createDesktopSettingsStore(directory)
  await store.save({
    piPath: '/opt/homebrew/bin/pi',
    selectedSessionId: 's-1',
    tabs: [{ sessionId: 's-1' }],
    version: 1,
  })
  const stored = await readFile(join(directory, 'settings.json'), 'utf8')
  assert.deepEqual(await store.load(), {
    piPath: '/opt/homebrew/bin/pi',
    selectedSessionId: 's-1',
    tabs: [{ sessionId: 's-1' }],
    version: 1,
  })
  assert.equal(stored.includes('apiSecret'), false)
})

test('migrates browser values only into missing desktop fields', () => {
  assert.deepEqual(
    migrateBrowserPreferences(
      {
        'pi-livecraft.selected-session': 'legacy-session',
        'pi-livecraft.workspace-sidebar-width': '300',
      },
      { tabs: [], version: 1 },
    ),
    { selectedSessionId: 'legacy-session', tabs: [], version: 1 },
  )
})

test('returns defaults for malformed or unsupported files', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pi-livecraft-settings-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const settingsPath = join(directory, 'settings.json')
  const store = createDesktopSettingsStore(directory)

  await writeFile(settingsPath, '{', 'utf8')
  assert.deepEqual(await store.load(), { tabs: [], version: 1 })

  await writeFile(settingsPath, JSON.stringify({ version: 2 }), 'utf8')
  assert.deepEqual(await store.load(), { tabs: [], version: 1 })
})
