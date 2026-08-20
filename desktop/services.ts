import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { request } from 'node:http'
import { createServer } from 'node:net'
import { resolve } from 'node:path'

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

export interface DesktopServicesOptions {
  distDirectory: string
  managerEntry: string
  piPath: string
  runtimeRoot: string
  backendEntry: string
  spawnProcess?: typeof spawn
}

/** Allocates a per-launch loopback-only configuration that is never persisted. */
export async function createLocalRuntime(): Promise<LocalRuntime> {
  const [backendPort, managerPort] = await Promise.all([reservePort(), reservePort()])
  if (backendPort === managerPort) return createLocalRuntime()
  return {
    apiSecret: randomBytes(32).toString('base64url'),
    backendPort,
    managerPort,
  }
}

/** Starts only the supervisor and backend; Pi process ownership remains with the manager. */
export function createDesktopServices(options: DesktopServicesOptions): DesktopServices {
  let backend: ChildProcess | undefined
  let supervisor: ChildProcess | undefined
  let runtime: LocalRuntime

  return {
    get runtime(): LocalRuntime {
      if (!runtime) throw new Error('Desktop services have not started')
      return runtime
    },

    async start(): Promise<void> {
      runtime = await createLocalRuntime()
      const spawnProcess = options.spawnProcess ?? spawn
      const environment = {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PI_LIVECRAFT_API_SECRET: runtime.apiSecret,
        PI_LIVECRAFT_BACKEND_PORT: String(runtime.backendPort),
        PI_LIVECRAFT_DIST_DIRECTORY: options.distDirectory,
        PI_LIVECRAFT_MANAGER_ENTRY: options.managerEntry.replace(
          'manager-supervisor.js',
          'manager.js',
        ),
        PI_LIVECRAFT_MANAGER_PORT: String(runtime.managerPort),
        PI_LIVECRAFT_PI_PATH: options.piPath,
        PI_LIVECRAFT_RUNTIME_ROOT: options.runtimeRoot,
      }

      try {
        supervisor = spawnProcess(process.execPath, [options.managerEntry], {
          env: environment,
          shell: false,
          stdio: 'inherit',
        })
        backend = spawnProcess(process.execPath, [options.backendEntry], {
          env: environment,
          shell: false,
          stdio: 'inherit',
        })
        await waitForHealth(runtime)
      } catch (error) {
        await stopChild(backend)
        await stopChild(supervisor)
        backend = undefined
        supervisor = undefined
        throw error
      }
    },

    async stop(): Promise<void> {
      await stopChild(backend)
      await stopChild(supervisor)
      backend = undefined
      supervisor = undefined
    },
  }
}

export function packagedRuntimeEntries(resourcesPath: string): Pick<
  DesktopServicesOptions,
  'backendEntry' | 'managerEntry'
> {
  return {
    backendEntry: resolve(resourcesPath, 'app.asar.unpacked', 'dist-runtime', 'backend.js'),
    managerEntry: resolve(
      resourcesPath,
      'app.asar.unpacked',
      'dist-runtime',
      'manager-supervisor.js',
    ),
  }
}

export function packagedDistDirectory(resourcesPath: string): string {
  return resolve(resourcesPath, 'app.asar', 'dist')
}

function reservePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Could not reserve a loopback port')))
        return
      }
      server.close((error) => error ? reject(error) : resolvePort(address.port))
    })
  })
}

function waitForHealth(runtime: LocalRuntime): Promise<void> {
  const deadline = Date.now() + 10_000
  return new Promise((resolveHealth, reject) => {
    const check = (): void => {
      const requestPath = `http://127.0.0.1:${runtime.backendPort}/api/health`
      const healthRequest = request(requestPath, {
        headers: { Authorization: `Bearer ${runtime.apiSecret}` },
        timeout: 500,
      })
      healthRequest.once('response', (response) => {
        response.resume()
        if (response.statusCode === 200) resolveHealth()
        else retry()
      })
      healthRequest.once('error', retry)
      healthRequest.end()
    }
    const retry = (): void => {
      if (Date.now() >= deadline) reject(new Error('Livecraft backend did not become healthy'))
      else setTimeout(check, 100)
    }
    check()
  })
}

async function stopChild(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))
  child.kill('SIGTERM')
  if (await settlesWithin(exited, 4_000)) return
  child.kill('SIGKILL')
  await settlesWithin(exited, 500)
}

function settlesWithin(promise: Promise<void>, timeoutMs: number): Promise<boolean> {
  return Promise.race([
    promise.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ])
}
