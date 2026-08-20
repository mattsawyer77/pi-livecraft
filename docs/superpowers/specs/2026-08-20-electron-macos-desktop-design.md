# Electron macOS desktop app design

## Goal

Ship Pi Livecraft as an unsigned, self-contained macOS `.app` that a user can install and launch without cloning the repository or running npm. The app packages Livecraft, but not Pi: it uses the user's existing, configured `pi` installation.

The first release is macOS-first but preserves a practical path to Windows and Linux packaging. Its primary interaction model is one application window with a native-style tab bar for concurrent Livecraft/Pi sessions.

## Non-goals

- Bundle, install, update, or alter the user's Pi executable, providers, settings, extensions, credentials, or session store.
- Change Pi's public RPC integration or move ownership of Pi processes out of the manager.
- Replace the existing browser-based developer workflow or Vite hot reload.
- Sign, notarize, or distribute through the Mac App Store in the first release.
- Support multiple application windows or tab detachment in the first release.

## Chosen approach

Use Electron and `electron-builder`.

Electron is the smallest compatible change for the current React/Vite/TypeScript and Node service architecture. The Electron main process owns only desktop-window and packaged-service lifecycle. It launches the existing Livecraft backend and manager supervisor as local services, then loads the production frontend from the app's local server/build. The existing manager remains the sole owner of `pi --mode rpc` child processes.

Tauri would require packaging Node services as sidecars or reimplementing them. A Swift shell would introduce a second platform stack without removing the Node packaging requirement. Neither benefits the first release enough to justify the extra complexity.

## Packaged architecture

```text
Electron main process
    ├─ resolves user-installed `pi`
    ├─ starts manager supervisor
    ├─ starts Livecraft backend
    └─ opens BrowserWindow
               │
               ▼
     packaged React/Vite frontend
               │ HTTP + SSE, loopback only
               ▼
       Livecraft backend
               │ local JSON Lines
               ▼
       manager supervisor → manager → user's `pi --mode rpc`
```

### Included

- Production Vite assets.
- Backend, manager supervisor, manager runtime modules, shared modules, and Pi extensions required by Livecraft.
- Electron main/preload code, packaging configuration, and application metadata.
- The runtime needed to execute Livecraft's Node-side services.

### Excluded

- Pi executable and its installation directory.
- Pi settings, credentials, provider configuration, extensions not belonging to Livecraft, and history/session data.
- Development-only Vite dev server and watch processes.

### Process lifecycle

1. Electron starts and creates a per-launch local runtime configuration.
2. It resolves and validates the `pi` command before session creation is enabled.
3. It starts the manager supervisor and backend with the resolved Pi path plus allocated loopback ports and an authentication secret.
4. Once the backend is healthy, Electron creates the sole `BrowserWindow` and loads the Livecraft frontend.
5. On a normal quit, Electron asks the local services to stop cleanly. The manager remains responsible for ending its Pi children according to its existing lifecycle guarantees.
6. If a local service fails, Electron presents a recoverable desktop error state rather than silently starting duplicate services.

The packaged lifecycle must respect the manager's guarded runtime-restart protocol. Electron must never bypass manager supervision or directly own/restart Pi processes.

## Pi discovery and configuration

A graphical macOS app may not inherit the same `PATH` as an interactive terminal. Pi discovery therefore follows this order:

1. Use a previously saved absolute Pi executable path, if valid.
2. Resolve `pi` through the user's login shell environment.
3. Check a small, documented set of standard macOS installation locations when the shell cannot resolve it.

The app validates a discovered executable using a harmless command before enabling new sessions. If validation fails, the main window shows a setup state with the detected result, an absolute-path preference, and a recheck action. It does not attempt to install Pi or modify shell configuration.

The resolved path is passed to the existing Pi-process launch boundary through an explicit runtime configuration, not injected into frontend state or copied into Pi configuration.

## Local security boundary

The existing services stay bound to `127.0.0.1`. Packaging introduces a per-launch random backend port and unguessable local authentication value. The BrowserWindow is the only intended caller of Livecraft's API; it receives connection details through a narrow, typed preload bridge or a runtime bootstrap document.

Electron security defaults:

- `contextIsolation: true`
- `nodeIntegration: false`
- no arbitrary renderer access to Node or Electron APIs
- a minimal preload surface limited to desktop needs
- navigation and new-window policies that deny untrusted external content

Existing backend input validation and shared HTTP/SSE contracts remain authoritative. Any token handling must be explicit in `src/api.ts` and backend validation rather than relying only on the port being private.

## Single-window session tabs

The first release adds a tab strip above the workbench inside one `BrowserWindow`. The tabs are Livecraft UI state, not native macOS document windows.

- Each tab corresponds to a Livecraft session and shows the session/workspace-derived title.
- A visible activity indicator identifies sessions currently running Pi work.
- Selecting a tab changes the active conversation/session rendering only; inactive tabs continue receiving state updates and their Pi processes continue running.
- Creating a tab uses the existing session creation flow.
- Closing a tab removes it from the visible tab strip. It must not implicitly stop an active Pi request or delete underlying history; existing session close/history semantics remain the source of truth.
- First-release tabs are limited to the single app window. Window restoration, tab detachment, and multiple desktop windows are deferred.

The existing manager already supports multiple concurrent Pi sessions. The frontend work is to express that concurrency as an explicit, persistent-in-window selection model rather than relying on browser tabs.

## Development workflow

`npm run dev` remains browser/Vite based and retains live self-modification. Electron development support may load the Vite URL and launch local services for desktop-specific work, but it must not replace or weaken the existing developer command.

Production Electron packaging uses the Vite build output and starts production backend/manager processes directly; it does not invoke `npm run`, Vite, or `concurrently` inside the `.app`.

## Build and release

Add Electron and `electron-builder` build scripts and configuration capable of producing an unsigned macOS `.app`, with a ZIP or DMG artifact. Start with architecture-specific artifacts; universal binaries can be evaluated after the runtime packaging is proven.

The release documentation must explain:

- Pi is a prerequisite and stays user-managed.
- How the app finds Pi and how to configure an absolute path.
- Gatekeeper's first-launch override for an unsigned app.
- The supported macOS and Node/Pi compatibility expectations.

Signing, notarization, automatic updates, and distribution hosting are explicitly deferred.

## Error handling

- Missing Pi: show setup state; do not expose normal session creation as functional.
- Invalid configured Pi path: retain the value for correction, explain the validation failure, and provide recheck/edit controls.
- Backend or manager start failure: show a retryable desktop diagnostic including a safe, actionable error; do not leak credentials or opaque stack traces by default.
- Manager disconnection after launch: preserve the current frontend behavior and manager status notifications; tabs remain visible and recover when the manager reconnects.
- Port collision or stale process: retry safely with a fresh local allocation; never kill an unrelated process merely because it owns a port.

## Validation strategy

Targeted automated coverage should prove:

- Pi command discovery precedence and validation behavior.
- Runtime configuration generated by Electron contains loopback-only ports and a launch-specific secret.
- Electron service orchestration starts backend/supervisor in order and performs orderly shutdown without directly manipulating Pi children.
- Tab reducer/component behavior preserves inactive running sessions, correct selection, and safe tab close semantics.
- Production package configuration includes required runtime files and excludes Pi.

Manual macOS acceptance checks should prove:

1. An unsigned artifact moves to Applications and launches via the documented Gatekeeper override.
2. The app finds a terminal-installed Pi, creates multiple sessions, and runs at least two concurrently.
3. Switching tabs does not interrupt background work; activity indicators update correctly.
4. Closing a visible tab does not cancel active work or erase Pi history.
5. A missing or invalid Pi path produces the setup state and can be fixed without reinstalling Livecraft.
6. Quit does not leave Livecraft backend/supervisor processes behind and follows manager shutdown behavior.

## Delivery phases

1. Establish Electron packaging and secure local service orchestration while preserving current browser development behavior.
2. Add Pi discovery, persisted executable-path preference, validation, and setup/error UI.
3. Add one-window session tabs backed by the current multi-session manager state.
4. Produce and manually validate an unsigned macOS artifact, then write end-user installation documentation.

Each phase should keep the browser application usable and validate its closest owning boundary before broad packaging checks.
