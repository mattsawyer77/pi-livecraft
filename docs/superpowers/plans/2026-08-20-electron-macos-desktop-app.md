# Electron macOS Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package Pi Livecraft as an unsigned macOS Electron app that uses a user-installed Pi, persists desktop settings on disk, presents concurrent sessions in a one-window tab strip, and produces its release artifact through a Nix flake.

**Architecture:** Electron main owns the window, the disk-backed desktop preferences, Pi discovery, and the lifecycle of the existing supervisor and backend. The backend and manager retain their current ownership boundary; both receive a launch-specific loopback configuration and authenticate all HTTP/SSE requests with an in-memory secret. The renderer uses a typed preload bridge for desktop preferences and exposes open Livecraft sessions through an app-local tab model without cancelling inactive work. A Nix flake supplies the pinned development toolchain and wraps the existing deterministic npm build steps in a native macOS arm64 derivation; `electron-builder` consumes Nix's Electron distribution instead of downloading a runtime during the build.

**Tech Stack:** Nix flakes, Nixpkgs Node 24 and Electron, Electron, electron-builder, React 19, Vite 8, TypeScript 6, node:test, existing local HTTP/SSE and JSON Lines manager protocols.

## Global Constraints

- Ship an unsigned macOS arm64 `.app`; signing, notarization, update delivery, universal binaries, cross-compilation, and multi-window support are out of scope.
- Nix is the authoritative desktop artifact entry point: `nix develop` provides the supported development shell and `nix build .#desktop` produces the unsigned macOS artifacts. The npm scripts remain internal build steps and usable for browser development.
- Build desktop artifacts natively on macOS arm64 only. The flake may provide a development shell on other Nix systems, but it must fail clearly rather than pretend to produce a macOS package there.
- The flake must pin Nixpkgs in `flake.lock`, use Nixpkgs' Node 24 and Electron, and set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` so a sandboxed build never fetches Electron from the network. `electron-builder` receives the Nix Electron application directory via its `electronDist` configuration.
- The Nix derivation must use `buildNpmPackage` with a committed `npmDepsHash`; it must not read the developer's `node_modules`, the per-user Electron cache, Pi installation, or user settings. Its output contains only `release/` artifacts.
- Do not package, install, mutate, or configure Pi; launch only the user’s existing Pi executable.
- Preserve `npm run dev` as the browser/Vite hot-reload workflow; production Electron must not invoke `npm run`, Vite, or `concurrently`.
- `server/manager.ts` remains the sole owner of `pi --mode rpc` processes. Electron must never spawn, restart, or kill Pi processes directly.
- Keep all network listeners on `127.0.0.1` and authenticate backend HTTP and SSE requests with a per-launch secret that is never written to disk.
- Desktop settings use Electron `app.getPath('userData')` (`~/Library/Application Support/Pi Livecraft` on macOS), versioned JSON, and user-only file permissions where supported.
- Disk settings contain only Livecraft-owned durable settings such as Pi path and tab/window restoration; never Pi credentials/configuration, backend secrets, or session credentials.
- Electron renderer security requires `contextIsolation: true`, `nodeIntegration: false`, a narrow typed preload API, and denied untrusted navigation/new windows.
- Keep browser-only preferences functional when Electron is unavailable. Existing browser storage is read once as a migration fallback and is never deleted.
- Use TypeScript with explicit interfaces and existing formatter/linter conventions. Do not add UI libraries.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `desktop/main.ts` | Electron main entry: process setup, settings/Pi discovery orchestration, local-service lifecycle, BrowserWindow and safe navigation policy. |
| `desktop/preload.ts` | Context-isolated, typed renderer bridge for reading/writing desktop preferences and receiving bootstrap status. |
| `desktop/shared.ts` | Shared serializable desktop API, bootstrap, settings, and tab-restoration types. |
| `desktop/settings.ts` | Versioned JSON settings parsing, atomic persistence, one-time legacy migration, and filesystem permission handling. |
| `desktop/pi-discovery.ts` | Resolve and validate an explicit/configured or login-shell-discovered Pi executable without a shell command injection path. |
| `desktop/services.ts` | Allocate ports/secret; spawn, health-check, and orderly stop only the backend and manager supervisor. |
| `desktop/build-runtime.mjs` | Uses esbuild to produce executable JavaScript bundles for Electron main/preload and the Node backend/supervisor runtime. |
| `desktop/electron-builder.yml` | Packaged-file inclusion/exclusion and unsigned macOS ZIP/DMG targets. |
| `desktop/tsconfig.json` | Electron main/preload typecheck configuration; runtime emission is owned by `desktop/build-runtime.mjs`. |
| `flake.nix` | Pinned Nix flake entry point: Node 24 development shell and native macOS arm64 `desktop` package derivation. |
| `flake.lock` | Resolved immutable Nixpkgs and flake utility inputs used by the development shell and desktop build. |
| `server/local-auth.ts` | Parse the optional launch secret and authorize HTTP/SSE requests using a constant-time comparison. |
| `server/backend.ts` | Apply backend local authentication, expose a health endpoint usable before renderer bootstrap, and accept injected frontend asset root/port. |
| `server/pi-launcher.ts` | Honor an explicit validated Pi executable from environment while retaining current Windows launcher behavior. |
| `src/desktop.ts` | Renderer adapter that detects Electron and reads/writes desktop preferences through the preload bridge, with browser-safe fallback. |
| `src/features/workspace/session-tabs.ts` | Pure tab restoration/reconciliation/close-selection logic. |
| `src/features/workspace/SessionTabs.tsx` | Accessible tab strip UI with running/starting activity and close controls. |
| `src/features/workspace/session-tabs.css` | Tab strip styling colocated with its component. |
| `src/App.tsx` | Hydrate desktop preferences/initial tab state, persist tab/window state, and mount the tab strip without changing manager ownership. |
| `src/api.ts` | Add the launch secret to HTTP requests and EventSource query parameters only when Electron bootstrap supplies it. |
| `src/App.css` | Import the feature-local session-tabs stylesheet. |
| `package.json` | Electron development, typecheck, package scripts, and dependencies. |
| `README.md` | Desktop install, Pi prerequisite/discovery, disk settings location, Gatekeeper override, and unsupported features. |
| `test/desktop-settings.test.ts` | Settings schema, atomic persistence, migration, and secret exclusion tests. |
| `test/nix-flake.test.ts` | Static contract for the Nix flake's pinned inputs, Node 24 shell, native Electron package, and no-network Electron configuration. |
| `test/pi-discovery.test.ts` | Pi resolution precedence and validation tests. |
| `test/desktop-services.test.ts` | Runtime configuration, launch order, health checks, and bounded shutdown tests with spawned-process seams. |
| `test/local-auth.test.ts` | Backend secret parsing and authorization tests. |
| `test/session-tabs.test.ts` | Pure tab restoration, activity, selection, and non-destructive close rules. |

## Task 1: Establish Electron build and package boundaries

**Files:**
- Create: `desktop/tsconfig.json`
- Create: `desktop/build-runtime.mjs`
- Create: `desktop/electron-builder.yml`
- Create: `desktop/main.ts`
- Create: `desktop/preload.ts`
- Create: `desktop/shared.ts`
- Create: `flake.nix`
- Create: `flake.lock`
- Create: `test/nix-flake.test.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces `DesktopBootstrap`, `DesktopPreferences`, and `DesktopBridge` from `desktop/shared.ts`.
- Produces JavaScript Electron output in `dist-desktop/` and bundled backend/supervisor output in `dist-runtime/`; package artifacts go in `release/` and are ignored by Git.
- Produces a Nix package named `desktop` on `aarch64-darwin`; its `$out` contains only the generated `release/` artifact contents. It uses the Nixpkgs Electron app directory for `electron-builder` and has no Pi runtime dependency.

- [ ] **Step 1: Add the failing Electron compilation/package configuration check**

Create `test/nix-flake.test.ts` alongside the initial package assertion:

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const flake = readFileSync(new URL('../flake.nix', import.meta.url), 'utf8')

test('defines a pinned Nix desktop package without downloading Electron', () => {
  assert.match(flake, /inputs\.nixpkgs\.url/)
  assert.match(flake, /nodejs_24/)
  assert.match(flake, /buildNpmPackage/)
  assert.match(flake, /ELECTRON_SKIP_BINARY_DOWNLOAD=1/)
  assert.match(flake, /electronDist/)
  assert.match(flake, /aarch64-darwin/)
  assert.equal(flake.includes('pi-coding-agent'), false)
})
```

Create `desktop/tsconfig.json`:

```json
{
  "extends": "../tsconfig.node.json",
  "compilerOptions": {
    "types": ["node", "electron"]
  },
  "include": ["**/*.ts"]
}
```

Add this initial package assertion to `test/desktop-services.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import packageJson from '../package.json' with { type: 'json' }

test('defines Electron desktop build and package scripts', () => {
  assert.equal(typeof packageJson.scripts['desktop:typecheck'], 'string')
  assert.equal(typeof packageJson.scripts['desktop:package'], 'string')
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- test/desktop-services.test.ts test/nix-flake.test.ts`

Expected: FAIL because `desktop:package` and `desktop:typecheck` do not exist and `flake.nix` does not exist.

- [ ] **Step 3: Add the minimal package configuration and desktop entrypoints**

Add `electron`, `electron-builder`, and `esbuild` as dev dependencies, then add these scripts and Electron metadata to `package.json`. Run this dependency update from `nix develop` once the flake exists; do not install a global Electron or use a downloaded Electron binary in the release derivation:

```json
{
  "main": "dist-desktop/main.js",
  "scripts": {
    "desktop:typecheck": "tsc --project desktop/tsconfig.json",
    "desktop:build": "npm run build && npm run desktop:typecheck && node desktop/build-runtime.mjs",
    "desktop:package": "npm run desktop:build && electron-builder --config desktop/electron-builder.yml"
  }
}
```

Create `desktop/build-runtime.mjs` using `esbuild.build()` four times with `{ bundle: true, format: 'esm', platform: 'node', sourcemap: false }` to compile these exact entrypoints:

```js
[
  ['desktop/main.ts', 'dist-desktop/main.js'],
  ['desktop/preload.ts', 'dist-desktop/preload.js'],
  ['server/backend.ts', 'dist-runtime/backend.js'],
  ['server/manager-supervisor.ts', 'dist-runtime/manager-supervisor.js'],
]
```

Set `packages: 'external'` for server bundles so production dependencies remain resolvable from the packaged app. This build step is required because the Electron-bundled Node runtime must execute JavaScript bundles, not the repository's Node 24 TypeScript source files.

Create `desktop/shared.ts`:

```ts
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
```

Create placeholder entrypoints that compile without providing Node access to the renderer:

```ts
// desktop/main.ts
import { app } from 'electron'

app.whenReady().catch((error: unknown) => {
  console.error(error)
  app.exit(1)
})

// desktop/preload.ts
export {}
```

Create `desktop/electron-builder.yml`:

```yaml
appId: dev.pi.livecraft
productName: Pi Livecraft
directories:
  output: release
  buildResources: build
files:
  - dist/**
  - dist-desktop/**
  - dist-runtime/**
  - pi-extensions/**
  - package.json
  - node_modules/**
  - "!node_modules/.cache/**"
  - "!node_modules/**/{test,tests,*.map}"
mac:
  target:
    - target: dmg
      arch:
        - arm64
    - target: zip
      arch:
        - arm64
  identity: null
```

Create `flake.nix` after `package.json` has the Electron dependencies. The flake must use the following complete structure (the final `npmDepsHash` is generated in the next step):

```nix
{
  description = "Pi Livecraft desktop build";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        lib = pkgs.lib;
        source = lib.cleanSourceWith {
          src = self;
          filter = path: type:
            let name = baseNameOf path;
            in !(builtins.elem name [ "node_modules" "dist" "dist-desktop" "dist-runtime" "release" ".git" ]);
        };
        desktop = pkgs.buildNpmPackage {
          pname = "pi-livecraft-desktop";
          version = "1.2.0";
          src = source;
          npmDepsHash = lib.fakeHash;
          nativeBuildInputs = [ pkgs.nodejs_24 ];
          ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
          ELECTRON_BUILDER_CACHE = "$TMPDIR/electron-builder-cache";
          buildPhase = ''
            runHook preBuild
            export HOME="$TMPDIR/home"
            mkdir -p "$HOME" "$ELECTRON_BUILDER_CACHE"
            npm run desktop:build
            npm exec electron-builder -- --config desktop/electron-builder.yml \\
              --mac --arm64 --publish never \\
              --config.electronDist="${pkgs.electron}/Applications"
            runHook postBuild
          '';
          installPhase = ''
            runHook preInstall
            mkdir -p "$out"
            cp -R release/. "$out/"
            runHook postInstall
          '';
        };
      in {
        devShells.default = pkgs.mkShell {
          packages = [ pkgs.nodejs_24 pkgs.nodePackages.npm ];
          ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
        };
        packages.desktop = if system == "aarch64-darwin" then desktop else
          throw "Pi Livecraft desktop artifacts must be built natively with nix build .#desktop on aarch64-darwin";
      });
}
```

Run `nix flake lock --update-input nixpkgs --update-input flake-utils` to create the committed `flake.lock`. Then run `nix build .#desktop --no-link`; Nix must fail only with the expected `npmDepsHash` mismatch. Replace `lib.fakeHash` with the `got:` hash printed by Nix. Repeat `nix build .#desktop --no-link` until it completes. This bootstrap build is the sole operation that populates Nix's immutable dependency store; after the real hash is committed, package builds are reproducible and do not use a developer's dependency cache.

Add `dist-desktop/`, `dist-runtime/`, and `release/` to `.gitignore`. Do not include `pi`, `.pi`, user settings, or Pi session paths in `files` or in the Nix derivation source.

- [ ] **Step 4: Run the focused check to verify it passes**

Run:

```bash
nix develop --command npm run desktop:typecheck
nix develop --command npm test -- test/desktop-services.test.ts test/nix-flake.test.ts
nix build .#desktop
```

Expected: TypeScript completes successfully, both contract tests pass, and on macOS arm64 `result/` contains unsigned `.dmg` and `.zip` artifacts. On another host, `nix build .#desktop` must fail with the explicit native-macOS message rather than creating an invalid artifact.

- [ ] **Step 5: Commit the independently buildable package skeleton**

```bash
git add package.json package-lock.json .gitignore flake.nix flake.lock desktop/tsconfig.json desktop/build-runtime.mjs desktop/electron-builder.yml desktop/main.ts desktop/preload.ts desktop/shared.ts test/desktop-services.test.ts test/nix-flake.test.ts
git commit -m "✨ Add Nix Electron packaging skeleton"
```

## Task 2: Implement disk-backed desktop preferences

**Files:**
- Create: `desktop/settings.ts`
- Create: `test/desktop-settings.test.ts`
- Modify: `desktop/shared.ts`

**Interfaces:**
- Consumes: `DesktopPreferences` from `desktop/shared.ts`.
- Produces:

```ts
export interface DesktopSettingsStore {
  load(): Promise<DesktopPreferences>
  save(preferences: DesktopPreferences): Promise<void>
}
export function createDesktopSettingsStore(userDataPath: string): DesktopSettingsStore
export function migrateBrowserPreferences(
  stored: Record<string, string | null>,
  preferences: DesktopPreferences,
): DesktopPreferences
```

- [ ] **Step 1: Write failing settings tests**

Create `test/desktop-settings.test.ts` with deterministic temporary-directory tests:

```ts
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createDesktopSettingsStore, migrateBrowserPreferences } from '../desktop/settings.ts'

test('writes versioned desktop preferences without launch secrets', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pi-livecraft-settings-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const store = createDesktopSettingsStore(directory)
  await store.save({ piPath: '/opt/homebrew/bin/pi', selectedSessionId: 's-1', tabs: [{ sessionId: 's-1' }], version: 1 })
  const stored = await readFile(join(directory, 'settings.json'), 'utf8')
  assert.deepEqual(await store.load(), {
    piPath: '/opt/homebrew/bin/pi', selectedSessionId: 's-1', tabs: [{ sessionId: 's-1' }], version: 1,
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
```

- [ ] **Step 2: Run the settings tests to verify they fail**

Run: `npm test -- test/desktop-settings.test.ts`

Expected: FAIL because `desktop/settings.ts` does not exist.

- [ ] **Step 3: Implement safe parsing, atomic writes, and migration**

Create `desktop/settings.ts` using `mkdir`, `readFile`, `rename`, `writeFile`, and a process-local temporary filename. Implement these rules exactly:

```ts
const SETTINGS_FILE = 'settings.json'
const defaultPreferences = (): DesktopPreferences => ({ tabs: [], version: 1 })
```

- `load()` returns `defaultPreferences()` on `ENOENT`, malformed JSON, unsupported `version`, or invalid field types.
- `save()` creates the `userDataPath` directory with mode `0o700`, writes JSON to `settings.json.<process.pid>.tmp` with mode `0o600`, then renames it to `settings.json`.
- `save()` serializes only `{ version, piPath, selectedSessionId, tabs, window }`; it must construct that object explicitly instead of spreading unknown input.
- `migrateBrowserPreferences()` sets `selectedSessionId` only when absent and the legacy value is a non-empty string. It must not import API URLs, secrets, or arbitrary local-storage keys.

Extend the test with malformed JSON and unsupported-version cases:

```ts
test('returns defaults for malformed or unsupported files', async (t) => {
  // Write malformed JSON, then a { version: 2 } document; both load as { tabs: [], version: 1 }.
})
```

- [ ] **Step 4: Run settings tests and static checks**

Run: `npm test -- test/desktop-settings.test.ts && npm run desktop:typecheck && npm run lint`

Expected: all commands exit 0.

- [ ] **Step 5: Commit disk-backed preferences**

```bash
git add desktop/shared.ts desktop/settings.ts test/desktop-settings.test.ts
git commit -m "✨ Persist desktop preferences on disk"
```

## Task 3: Add Pi executable discovery and manager launch injection

**Files:**
- Create: `desktop/pi-discovery.ts`
- Create: `test/pi-discovery.test.ts`
- Modify: `server/pi-launcher.ts`
- Modify: `server/pi-process.ts`

**Interfaces:**
- Produces:

```ts
export interface PiDiscoveryResult {
  message?: string
  path?: string
  ready: boolean
}
export function discoverPi(options: {
  configuredPath?: string
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  run?: (command: string, args: string[]) => Promise<{ code: number; stdout: string }>
}): Promise<PiDiscoveryResult>
```

- Consumes: `PI_LIVECRAFT_PI_PATH` in `server/pi-launcher.ts`.
- Produces: `resolvePiLauncher()` returns the explicit validated POSIX Pi path before the regular PATH lookup.

- [ ] **Step 1: Write failing discovery tests**

Create `test/pi-discovery.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { discoverPi } from '../desktop/pi-discovery.ts'

test('prefers a configured executable path after validation', async () => {
  const calls: string[] = []
  const result = await discoverPi({
    configuredPath: '/Users/me/bin/pi',
    run: async (command, args) => {
      calls.push(`${command} ${args.join(' ')}`)
      return { code: 0, stdout: 'pi 1.0.0' }
    },
  })
  assert.deepEqual(result, { path: '/Users/me/bin/pi', ready: true })
  assert.deepEqual(calls, ['/Users/me/bin/pi --version'])
})

test('uses login-shell command resolution when no configured path exists', async () => {
  const result = await discoverPi({
    run: async (command, args) => {
      assert.equal(command, '/bin/zsh')
      assert.deepEqual(args, ['-l', '-c', 'command -v pi'])
      return { code: 0, stdout: '/opt/homebrew/bin/pi\n' }
    },
  })
  assert.deepEqual(result, { path: '/opt/homebrew/bin/pi', ready: true })
})

test('returns a safe setup message when discovery fails', async () => {
  assert.deepEqual(
    await discoverPi({ run: async () => ({ code: 1, stdout: '' }) }),
    { message: 'Pi was not found. Install Pi or choose its executable path in Settings.', ready: false },
  )
})
```

- [ ] **Step 2: Run the discovery tests to verify they fail**

Run: `npm test -- test/pi-discovery.test.ts`

Expected: FAIL because `desktop/pi-discovery.ts` does not exist.

- [ ] **Step 3: Implement safe discovery and explicit launcher support**

Implement `discoverPi()` so it:

- validates a configured absolute path by executing it as `spawn(path, ['--version'], { shell: false })`;
- otherwise executes only the fixed macOS login-shell command `'/bin/zsh', ['-l', '-c', 'command -v pi']` with `shell: false`;
- trims one stdout line, verifies it is absolute, then validates it with `--version`;
- checks `/opt/homebrew/bin/pi` and `/usr/local/bin/pi` on macOS only after shell lookup fails;
- returns the exact missing-Pi message from the test and does not attempt installation.

Update `resolvePiLauncher()` at its start:

```ts
const explicitPath = env.PI_LIVECRAFT_PI_PATH
if (platform !== 'win32' && explicitPath && isAbsolute(explicitPath)) {
  return { command: explicitPath, argsPrefix: [] }
}
```

Update `PiProcess` so `PI_LIVECRAFT_PI_PATH` remains in the child process environment by retaining `...process.env` for normal and isolated launches. Do not pass this path to the renderer.

- [ ] **Step 4: Run focused Pi tests**

Run: `npm test -- test/pi-discovery.test.ts test/pi-launcher.test.ts test/pi-process.test.ts`

Expected: all tests pass, including current Windows shim safety coverage.

- [ ] **Step 5: Commit Pi discovery**

```bash
git add desktop/pi-discovery.ts test/pi-discovery.test.ts server/pi-launcher.ts server/pi-process.ts
git commit -m "✨ Discover user-installed Pi for desktop"
```

## Task 4: Secure and orchestrate packaged local services

**Files:**
- Create: `desktop/services.ts`
- Create: `server/local-auth.ts`
- Create: `test/desktop-services.test.ts`
- Create: `test/local-auth.test.ts`
- Modify: `server/backend.ts`
- Modify: `src/api.ts`
- Modify: `desktop/shared.ts`

**Interfaces:**
- Produces:

```ts
export interface LocalRuntime {
  apiSecret: string
  backendPort: number
  managerPort: number
}
export interface DesktopServices {
  runtime: LocalRuntime
  start(): Promise<void>
  stop(): Promise<void>
}
export function createDesktopServices(options: DesktopServicesOptions): DesktopServices
```

- Produces `authorizeLocalRequest(request, expectedSecret): boolean` from `server/local-auth.ts`.
- `DesktopBootstrap` gains `backendUrl` and `apiSecret`; `src/api.ts` adds these only when bootstrapped in Electron.

- [ ] **Step 1: Write the failing service/auth tests**

Create `test/local-auth.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { authorizeLocalRequest } from '../server/local-auth.ts'

test('authorizes only the exact bearer token', () => {
  assert.equal(authorizeLocalRequest({ headers: { authorization: 'Bearer launch-secret' } }, 'launch-secret'), true)
  assert.equal(authorizeLocalRequest({ headers: { authorization: 'Bearer wrong' } }, 'launch-secret'), false)
  assert.equal(authorizeLocalRequest({ headers: {} }, 'launch-secret'), false)
})

test('allows browser development when no secret was configured', () => {
  assert.equal(authorizeLocalRequest({ headers: {} }, undefined), true)
})
```

Extend `test/desktop-services.test.ts`:

```ts
test('creates unique loopback runtime values and does not persist its secret', async () => {
  const first = await createLocalRuntime()
  const second = await createLocalRuntime()
  assert.notEqual(first.apiSecret, second.apiSecret)
  assert.notEqual(first.backendPort, first.managerPort)
  assert.match(first.apiSecret, /^[A-Za-z0-9_-]{43}$/)
})
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- test/local-auth.test.ts test/desktop-services.test.ts`

Expected: FAIL because the auth and runtime modules do not exist.

- [ ] **Step 3: Implement authentication and service lifecycle**

In `server/local-auth.ts`, use `timingSafeEqual` on UTF-8 buffers of equal length:

```ts
export function authorizeLocalRequest(
  request: Pick<IncomingMessage, 'headers'>,
  expectedSecret: string | undefined,
): boolean {
  if (!expectedSecret) return true
  const authorization = request.headers.authorization
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return false
  const supplied = Buffer.from(authorization.slice('Bearer '.length))
  const expected = Buffer.from(expectedSecret)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
```

In `server/backend.ts`:

- read `PI_LIVECRAFT_API_SECRET` once at startup;
- allow unauthenticated `GET /api/health` only before production bootstrap is loaded, then otherwise authorize before all `/api/*` routes and `/api/events`;
- return JSON `401` for regular API requests and HTTP `401` before opening an SSE stream;
- continue binding to `127.0.0.1`;
- use `PI_LIVECRAFT_BACKEND_PORT` and existing manager-port environment support; add `PI_LIVECRAFT_DIST_DIRECTORY` as an absolute override for packaged frontend assets.

In `desktop/services.ts`:

- implement `createLocalRuntime()` using `crypto.randomBytes(32).toString('base64url')` and two ports obtained by binding temporary `net.createServer()` instances to `127.0.0.1` with port `0`;
- spawn bundled `dist-runtime/manager-supervisor.js` first, then bundled `dist-runtime/backend.js`, using Electron’s executable with `ELECTRON_RUN_AS_NODE=1`, an absolute unpacked-resource entry path, `shell: false`, and an explicit environment containing `PI_LIVECRAFT_MANAGER_PORT`, `PI_LIVECRAFT_BACKEND_PORT`, `PI_LIVECRAFT_API_SECRET`, `PI_LIVECRAFT_PI_PATH`, and `PI_LIVECRAFT_DIST_DIRECTORY`;
- poll `GET /api/health` with `Authorization: Bearer <secret>` until 200 or a 10-second deadline;
- on failure, terminate only the spawned supervisor/backend child handles; never scan or kill by port;
- `stop()` sends `SIGTERM` to backend then supervisor, waits up to 4 seconds each, and sends `SIGKILL` only to those still-running spawned child handles.

In `src/api.ts`, create a module-local `configureApi({ backendUrl, apiSecret }: Pick<DesktopBootstrap, 'backendUrl' | 'apiSecret'>): void` and use it in `request()` and `subscribeManagerEvents()`:

```ts
const headers = apiSecret ? { Authorization: `Bearer ${apiSecret}` } : {}
const url = new URL(path, backendUrl ?? window.location.origin)
if (apiSecret) url.searchParams.set('token', apiSecret)
```

For SSE, backend accepts the exact token query parameter only for `GET /api/events`, compares it with the same helper, and never logs it. For normal fetches, merge `headers` with caller headers.

- [ ] **Step 4: Run focused tests, then typecheck**

Run: `npm test -- test/local-auth.test.ts test/desktop-services.test.ts test/api-events.test.ts && npm run typecheck && npm run desktop:typecheck`

Expected: all exit 0.

- [ ] **Step 5: Commit authenticated local services**

```bash
git add desktop/services.ts desktop/shared.ts server/local-auth.ts server/backend.ts src/api.ts test/local-auth.test.ts test/desktop-services.test.ts
git commit -m "✨ Secure packaged local services"
```

## Task 5: Wire Electron main, preload, bootstrap, and recoverable setup state

**Files:**
- Modify: `desktop/main.ts`
- Modify: `desktop/preload.ts`
- Modify: `desktop/shared.ts`
- Modify: `src/main.tsx`
- Create: `src/desktop.ts`
- Create: `test/desktop-bootstrap.test.ts`

**Interfaces:**
- Consumes `createDesktopSettingsStore`, `discoverPi`, `createDesktopServices`, and `DesktopBridge`.
- Produces `loadDesktopBootstrap(): Promise<DesktopBootstrap | null>` from `src/desktop.ts`.
- `desktop/main.ts` registers IPC handlers named `pi-livecraft:get-bootstrap` and `pi-livecraft:save-preferences` only.

- [ ] **Step 1: Write the failing renderer bootstrap tests**

Create `test/desktop-bootstrap.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeDesktopPreferences } from '../src/desktop.ts'

test('keeps desktop values authoritative while importing absent browser fallback values', () => {
  assert.deepEqual(
    mergeDesktopPreferences(
      { selectedSessionId: 'disk', tabs: [{ sessionId: 'disk' }], version: 1 },
      { 'pi-livecraft.selected-session': 'browser' },
    ),
    { selectedSessionId: 'disk', tabs: [{ sessionId: 'disk' }], version: 1 },
  )
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- test/desktop-bootstrap.test.ts`

Expected: FAIL because `src/desktop.ts` does not exist.

- [ ] **Step 3: Implement the Electron boundary and renderer bootstrap**

In `desktop/main.ts`:

1. call `app.setName('Pi Livecraft')` before `app.whenReady()`;
2. create the store from `app.getPath('userData')` and load preferences;
3. call `discoverPi({ configuredPath: preferences.piPath })`;
4. only when Pi is ready, create/start `DesktopServices`; otherwise create a BrowserWindow that loads the renderer setup state without services;
5. create one `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, a preload path resolving to `dist-desktop/preload.js`, and bounds restored from `preferences.window`;
6. serve `dist/index.html` through the authenticated backend when services are ready; when Pi is missing, load the static production index and pass a bootstrap object with `ready: false`;
7. register only these IPC handlers:

```ts
ipcMain.handle('pi-livecraft:get-bootstrap', () => bootstrap)
ipcMain.handle('pi-livecraft:save-preferences', async (_event, preferences: DesktopPreferences) => {
  await store.save(preferences)
  bootstrap = { ...bootstrap, preferences }
})
```

8. on `close`, save bounded window coordinates/size and desktop tab state already supplied by the renderer; on `before-quit`, await `services.stop()` exactly once;
9. use `setWindowOpenHandler(() => ({ action: 'deny' }))` and `will-navigate` to prevent all non-backend navigation; send allowed external links through `shell.openExternal()` only after validating `https:`.

In `desktop/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopBridge, DesktopBootstrap, DesktopPreferences } from './shared.ts'

const bridge: DesktopBridge = {
  getBootstrap: () => ipcRenderer.invoke('pi-livecraft:get-bootstrap') as Promise<DesktopBootstrap>,
  savePreferences: (preferences) => ipcRenderer.invoke('pi-livecraft:save-preferences', preferences) as Promise<void>,
}
contextBridge.exposeInMainWorld('piLivecraftDesktop', bridge)
```

In `src/desktop.ts`, return `null` when `window.piLivecraftDesktop` is absent. When present, `loadDesktopBootstrap()` awaits `getBootstrap()`, calls `configureApi()` only if `bootstrap.pi.ready`, and returns the result. Export the pure `mergeDesktopPreferences()` used by the test.

In `src/main.tsx`, await `loadDesktopBootstrap()` before rendering `<App desktopBootstrap={bootstrap} />`. Update `App` props to show a setup panel when `desktopBootstrap?.pi.ready === false`; its only controls are a read-only detected-status message and a button opening the existing settings panel where the Pi path preference will be edited in Task 6.

- [ ] **Step 4: Run focused bootstrap and browser regression tests**

Run: `npm test -- test/desktop-bootstrap.test.ts test/api-events.test.ts && npm run typecheck && npm run desktop:typecheck`

Expected: all pass; the browser test continues to run without an Electron bridge.

- [ ] **Step 5: Commit desktop lifecycle and renderer bridge**

```bash
git add desktop/main.ts desktop/preload.ts desktop/shared.ts src/main.tsx src/App.tsx src/desktop.ts test/desktop-bootstrap.test.ts
git commit -m "✨ Launch Livecraft from Electron"
```

## Task 6: Add desktop Pi-path configuration and migration-safe preferences adapter

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/settings/SettingsPanel.tsx`
- Modify: `src/features/settings/settings.css`
- Modify: `src/desktop.ts`
- Modify: `desktop/settings.ts`
- Create: `test/desktop-preferences.test.ts`

**Interfaces:**
- `App` owns `desktopPreferences: DesktopPreferences | null` and persists changes via `window.piLivecraftDesktop?.savePreferences()`.
- `SettingsPanel` gains optional props:

```ts
piPath?: string
onPiPathChange?: (path: string) => void
```

- [ ] **Step 1: Write failing preference adapter tests**

Create `test/desktop-preferences.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { applyDesktopPreference } from '../src/desktop.ts'

test('updates only declared desktop preference keys', () => {
  assert.deepEqual(
    applyDesktopPreference({ tabs: [], version: 1 }, { piPath: '/usr/local/bin/pi' }),
    { piPath: '/usr/local/bin/pi', tabs: [], version: 1 },
  )
})

test('rejects a secret-shaped preference update', () => {
  assert.throws(
    () => applyDesktopPreference({ tabs: [], version: 1 }, { apiSecret: 'nope' } as never),
    /Unknown desktop preference/,
  )
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- test/desktop-preferences.test.ts`

Expected: FAIL because `applyDesktopPreference` is not exported.

- [ ] **Step 3: Implement narrow preference editing and settings UI**

Add `applyDesktopPreference()` to `src/desktop.ts`. It must accept only `piPath`, `selectedSessionId`, `tabs`, and `window`; throw `new Error('Unknown desktop preference')` for every other key. It returns a new version-1 preference object.

In `App.tsx`:

- initialize from `desktopBootstrap?.preferences` when present;
- call the bridge save method only after a user setting/tab/window action; do not overwrite the file during initial render;
- retain all current `localStorage` reads/writes in browser mode;
- when desktop preferences exist, use `desktopPreferences.piPath` as the SettingsPanel value and persist a trimmed absolute path or `undefined`.

In `SettingsPanel.tsx`, render this desktop-only field in the existing settings layout:

```tsx
{onPiPathChange && (
  <label className='desktop-setting-field'>
    <span>Pi executable</span>
    <input
      onChange={(event) => onPiPathChange(event.target.value)}
      placeholder='/opt/homebrew/bin/pi'
      type='text'
      value={piPath ?? ''}
    />
    <small>Restart Pi Livecraft after changing this path.</small>
  </label>
)}
```

Add only `.desktop-setting-field` styles in `settings.css`, following existing label/input variables. Do not add a filesystem picker: an explicit path is the first-release contract.

- [ ] **Step 4: Run focused tests and UI typecheck**

Run: `npm test -- test/desktop-preferences.test.ts test/desktop-settings.test.ts && npm run typecheck && npm run lint`

Expected: all exit 0.

- [ ] **Step 5: Commit Pi-path desktop preference UI**

```bash
git add src/App.tsx src/desktop.ts src/features/settings/SettingsPanel.tsx src/features/settings/settings.css desktop/settings.ts test/desktop-preferences.test.ts
git commit -m "✨ Configure Pi path in desktop settings"
```

## Task 7: Model and render single-window session tabs

**Files:**
- Create: `src/features/workspace/session-tabs.ts`
- Create: `src/features/workspace/SessionTabs.tsx`
- Create: `src/features/workspace/session-tabs.css`
- Create: `test/session-tabs.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes `SessionSummary` from `shared/types.ts` and `DesktopTabState` from `src/desktop.ts` re-export.
- Produces:

```ts
export interface SessionTab {
  id: string
  running: boolean
  title: string
}
export function reconcileSessionTabs(
  persisted: readonly DesktopTabState[],
  sessions: readonly SessionSummary[],
  selectedId: string,
): SessionTab[]
export function selectAfterTabClose(
  closedId: string,
  tabs: readonly SessionTab[],
  selectedId: string,
): string
```

- [ ] **Step 1: Write failing pure tab behavior tests**

Create `test/session-tabs.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcileSessionTabs, selectAfterTabClose } from '../src/features/workspace/session-tabs.ts'

const sessions = [
  { id: 'a', cwd: '/a', name: 'Build app', pendingUi: [], sessionPath: '/a.jsonl', status: 'running' as const },
  { id: 'b', cwd: '/b', name: 'Review code', pendingUi: [], sessionPath: '/b.jsonl', status: 'idle' as const },
]

test('restores live persisted tabs and includes the selected live session', () => {
  assert.deepEqual(reconcileSessionTabs([{ sessionId: 'b' }], sessions, 'a'), [
    { id: 'b', running: false, title: 'Review code' },
    { id: 'a', running: true, title: 'Build app' },
  ])
})

test('selects the adjacent visible tab after closing the selected tab', () => {
  const tabs = [
    { id: 'a', running: true, title: 'A' },
    { id: 'b', running: false, title: 'B' },
    { id: 'c', running: false, title: 'C' },
  ]
  assert.equal(selectAfterTabClose('b', tabs, 'b'), 'c')
  assert.equal(selectAfterTabClose('a', tabs, 'a'), 'b')
  assert.equal(selectAfterTabClose('b', tabs, 'a'), 'a')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- test/session-tabs.test.ts`

Expected: FAIL because `session-tabs.ts` does not exist.

- [ ] **Step 3: Implement pure tab reconciliation and accessible rendering**

In `session-tabs.ts`:

- discard persisted tab ids no longer represented by a non-exited session;
- retain persisted order;
- append `selectedId` if it is a non-exited session not already present;
- derive `running` from `status === 'running' || status === 'starting'`;
- `selectAfterTabClose()` returns the following tab, otherwise prior tab, otherwise `''`, and returns the original selected id when closing a background tab.

Create `SessionTabs.tsx` with this public shape:

```ts
interface SessionTabsProps {
  selectedId: string
  tabs: readonly SessionTab[]
  onClose: (sessionId: string) => void
  onSelect: (sessionId: string) => void
}
```

Render a `role='tablist'` container; each session button uses `role='tab'`, `aria-selected`, and an activity span with `aria-label='Running'` only for running tabs. Give each close button an `aria-label={`Close ${tab.title}`}`, call `event.stopPropagation()`, and never issue `closeSession()` from this component.

Add feature-local CSS that creates a compact horizontal strip, truncates titles, keeps close buttons visible on keyboard focus, and uses existing theme CSS variables. Do not create a separate native window or a new UI dependency.

- [ ] **Step 4: Integrate tabs without changing Pi session lifecycle**

In `App.tsx`:

1. derive `sessionTabs = reconcileSessionTabs(desktopPreferences?.tabs ?? [], sessions, selectedId)`;
2. render `<SessionTabs>` at the beginning of `<main className='workspace'>` only in desktop mode;
3. on tab select call existing `setSelectedId(sessionId)`;
4. on tab close, update only desktop `tabs` using `selectAfterTabClose()`, then call `setSelectedId(nextId)` if the closed tab was selected; **do not call** `closeManagedSession`;
5. when an existing sidebar action creates, opens, or selects a session, reconcile/persist it as a visible tab; inactive sessions continue to receive manager/SSE updates through existing code;
6. persist only `sessionTabs.map(({ id }) => ({ sessionId: id }))` and `selectedId` through the desktop bridge.

Import the feature stylesheet in `src/App.css` after `workspace.css`:

```css
@import "./features/workspace/session-tabs.css";
```

- [ ] **Step 5: Run tab and workspace regressions**

Run: `npm test -- test/session-tabs.test.ts test/sidebar-sessions.test.ts test/conversation-runtime.test.ts && npm run typecheck && npm run lint`

Expected: all pass. The tab unit tests prove a close is UI-only; existing manager tests continue to own actual process-close behavior.

- [ ] **Step 6: Commit session tabs**

```bash
git add src/App.tsx src/App.css src/features/workspace/session-tabs.ts src/features/workspace/SessionTabs.tsx src/features/workspace/session-tabs.css test/session-tabs.test.ts
git commit -m "✨ Add desktop session tabs"
```

## Task 8: Finalize production packaging and end-user documentation

**Files:**
- Modify: `desktop/build-runtime.mjs`
- Modify: `desktop/electron-builder.yml`
- Modify: `flake.nix`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-20-electron-macos-desktop-design.md`

**Interfaces:**
- Consumes package scripts and desktop entrypoints from Tasks 1–7.
- Produces `release/Pi Livecraft-<version>-arm64.dmg` and ZIP artifacts from `npm run desktop:package` on macOS arm64.

- [ ] **Step 1: Add a failing package-content assertion**

Add to `test/desktop-services.test.ts`:

```ts
test('desktop builder excludes Pi and includes Livecraft runtime directories', () => {
  const config = readFileSync(new URL('../desktop/electron-builder.yml', import.meta.url), 'utf8')
  assert.match(config, /- dist-runtime\/\*\*/)
  assert.match(config, /- pi-extensions\/\*\*/)
  assert.equal(config.includes('pi-coding-agent'), false)
})
```

- [ ] **Step 2: Run the assertion to verify the intended package contract**

Run: `npm test -- test/desktop-services.test.ts`

Expected: PASS if Task 1’s builder configuration remains compliant; otherwise adjust only the file patterns needed to make the test pass.

- [ ] **Step 3: Complete packaging metadata and user documentation**

Ensure `electron-builder.yml` explicitly includes the built JavaScript runtime directories `dist/`, `dist-desktop/`, and `dist-runtime/`, plus `pi-extensions/` and production dependencies Electron needs. Configure `asarUnpack` for `dist-runtime/**` and `pi-extensions/**` so their paths are executable/readable from spawned Node processes. Explicitly exclude `test/`, `.git/`, source maps, development-only Vite files, and all Pi package/executable paths.

Re-read `flake.nix` after the runtime package configuration is final. Keep its source filter aligned with generated directories, retain the committed non-fake `npmDepsHash`, and ensure `buildPhase` invokes only `npm run desktop:build` plus `electron-builder` with `--config.electronDist="${pkgs.electron}/Applications"`. Do not add `curl`, `npm install`, `npm update`, `nix profile install`, or a Pi dependency to the derivation; `nix build .#desktop` must remain an isolated native macOS arm64 package build.

Add this README section after Quick start:

```markdown
## macOS desktop app (unsigned preview)

The desktop build packages Pi Livecraft, not Pi. Install and configure Pi first, then open **Pi Livecraft.app**. On first launch the app searches your login-shell PATH, `/opt/homebrew/bin/pi`, and `/usr/local/bin/pi`. Set an absolute Pi executable path in Settings if discovery fails, then restart the app.

Desktop preferences are stored in `~/Library/Application Support/Pi Livecraft/settings.json`. This file contains Livecraft settings such as the Pi path and restored tabs; it does not contain Pi credentials, provider settings, or the per-launch local API secret.

The preview app is unsigned. If macOS blocks the first launch, open it from Finder with Control-click → Open, then confirm Open. Do not bypass Gatekeeper for an artifact you did not obtain from a trusted source.

One app window supports multiple session tabs. Closing a tab only hides it from the tab strip; it does not stop running Pi work or erase session history.
```

Document `nix develop` as the supported reproducible Node/Electron shell and `nix build .#desktop` as the supported macOS arm64 packaging command; explain that artifacts are linked at `result/` and can be copied from there. Retain `npm run desktop:package` as the lower-level local command for Electron debugging, but do not present it as the release pipeline. Do not promise universal binaries, signing, auto-update, cross-compilation, or multi-window support.

- [ ] **Step 4: Run release-quality checks**

Run:

```bash
npm run format:check -- desktop src/App.tsx src/api.ts server/backend.ts server/local-auth.ts README.md
npm run lint
npm run typecheck
npm run desktop:typecheck
npm test -- test/desktop-settings.test.ts test/pi-discovery.test.ts test/desktop-services.test.ts test/local-auth.test.ts test/desktop-bootstrap.test.ts test/desktop-preferences.test.ts test/session-tabs.test.ts test/manager-runtime.test.ts test/manager-runtime-monitor.test.ts test/manager.integration.test.ts
nix develop --command npm run desktop:package
nix build .#desktop
```

Expected: all checks exit 0 and `result/` contains unsigned arm64 `.dmg` and `.zip` artifacts produced by the Nix derivation. On a macOS host, manually perform the seven acceptance checks from the design spec: Gatekeeper launch, discovery, concurrent sessions, tab switching, non-destructive close, persisted settings without secret, and clean quit.

- [ ] **Step 5: Commit packaging and documentation**

```bash
git add desktop/build-runtime.mjs desktop/electron-builder.yml flake.nix flake.lock package.json package-lock.json README.md docs/superpowers/specs/2026-08-20-electron-macos-desktop-design.md test/desktop-services.test.ts test/nix-flake.test.ts
git commit -m "📦 Package the macOS desktop app with Nix"
```

## Plan self-review

- **Spec coverage:** Tasks 1 and 8 produce unsigned native macOS arm64 packaging through a pinned Nix flake; Task 3 keeps Pi user-installed; Task 4 preserves the manager ownership boundary and introduces loopback auth; Tasks 2 and 6 implement well-known disk settings, migration, and renderer isolation; Task 5 implements Electron security/lifecycle and missing-Pi recovery; Task 7 adds one-window non-destructive concurrent session tabs; Task 8 covers Nix release validation, docs, and manual acceptance.
- **No hidden process ownership change:** Electron starts only backend/supervisor, while supervisor → manager remains the exclusive path to Pi processes.
- **No placeholders:** Every task has exact paths, named interfaces, failing tests, commands, expected results, and a bounded commit.
- **Type consistency:** `DesktopPreferences`, `DesktopBootstrap`, `DesktopBridge`, `createDesktopServices`, `discoverPi`, `configureApi`, `reconcileSessionTabs`, and `selectAfterTabClose` are introduced before consumption and use identical names throughout.
