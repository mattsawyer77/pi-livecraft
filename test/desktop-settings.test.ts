import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  createDesktopSettingsStore,
  migrateBrowserPreferences,
  saveDesktopWindowBounds,
} from '../desktop/settings.ts'

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

test('saves window bounds without overwriting newer renderer preferences', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pi-livecraft-settings-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const store = createDesktopSettingsStore(directory)
  await store.save({ themePreferences: { active: 'dark', themes: [] }, tabs: [], version: 1 })
  await saveDesktopWindowBounds(store, { height: 900, width: 1400 })
  assert.deepEqual(await store.load(), {
    themePreferences: { active: 'dark', themes: [] },
    tabs: [],
    version: 1,
    window: { height: 900, width: 1400 },
  })
})

test('preserves existing preferences across independent saves', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pi-livecraft-settings-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const store = createDesktopSettingsStore(directory)
  await store.save({
    themePreferences: { active: 'dark', themes: [] },
    uiPreferences: { workspacePath: '/workspace' },
    tabs: [],
    version: 1,
  })
  await store.save({ tabs: [{ sessionId: 'session-1' }], version: 1 })
  assert.deepEqual(await store.load(), {
    themePreferences: { active: 'dark', themes: [] },
    uiPreferences: { workspacePath: '/workspace' },
    tabs: [{ sessionId: 'session-1' }],
    version: 1,
  })
})

test('merges concurrent desktop preference saves', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pi-livecraft-settings-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const store = createDesktopSettingsStore(directory)
  await Promise.all([
    store.save({ themePreferences: { active: 'dark', themes: [] }, tabs: [], version: 1 }),
    store.save({ tabs: [], uiPreferences: { workspacePath: '/workspace' }, version: 1 }),
  ])
  assert.deepEqual(await store.load(), {
    themePreferences: { active: 'dark', themes: [] },
    tabs: [],
    uiPreferences: { workspacePath: '/workspace' },
    version: 1,
  })
})

test('persists validated desktop UI preferences', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pi-livecraft-settings-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const store = createDesktopSettingsStore(directory)
  const uiPreferences = {
    conversationView: 'semi-detailed',
    recentWorkspacePaths: ['/workspace'],
    rightSidebarWidth: 420,
    selectedRightWidget: 'todo',
    shortcuts: { send: 'Meta+Enter' },
    terminalCommand: 'open -a Terminal {cwd}',
    workspacePath: '/workspace',
    workspaceSidebarCollapsed: true,
    workspaceSidebarWidth: 280,
  } as const
  await store.save({ tabs: [], uiPreferences, version: 1 })
  assert.deepEqual(await store.load(), { tabs: [], uiPreferences, version: 1 })
})

test('persists desktop-owned theme preferences', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pi-livecraft-settings-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const store = createDesktopSettingsStore(directory)
  const themePreferences = { active: 'dark', themes: [] }
  await store.save({ tabs: [], themePreferences, version: 1 })
  assert.deepEqual(await store.load(), { tabs: [], themePreferences, version: 1 })
})

test('serializes concurrent preference writes without losing the settings file', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pi-livecraft-settings-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const store = createDesktopSettingsStore(directory)
  await Promise.all([
    store.save({ piPath: '/one/pi', tabs: [], version: 1 }),
    store.save({ piPath: '/two/pi', tabs: [], version: 1 }),
  ])
  assert.match((await store.load()).piPath ?? '', /^\/(one|two)\/pi$/)
})

test('cleans up a temporary file when replacing settings fails', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pi-livecraft-settings-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  await mkdir(join(directory, 'settings.json'))
  const store = createDesktopSettingsStore(directory)

  await assert.rejects(
    store.save({ tabs: [], version: 1 }),
  )

  assert.deepEqual(
    (await readdir(directory)).filter((name) => name.endsWith('.tmp')),
    [],
  )
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
