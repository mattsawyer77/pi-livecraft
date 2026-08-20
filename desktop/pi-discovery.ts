import { spawn } from 'node:child_process'
import { isAbsolute } from 'node:path'

const missingPiMessage = 'Pi was not found. Install Pi or choose its executable path in Settings.'

export interface PiDiscoveryResult {
  message?: string
  path?: string
  ready: boolean
}

interface CommandResult {
  code: number
  stdout: string
}

interface PiDiscoveryOptions {
  configuredPath?: string
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  run?: (command: string, args: string[]) => Promise<CommandResult>
}

/** Finds a user-managed Pi executable without evaluating user-provided text in a shell. */
export async function discoverPi(options: PiDiscoveryOptions = {}): Promise<PiDiscoveryResult> {
  const run = options.run ?? runCommand
  const platform = options.platform ?? process.platform

  if (options.configuredPath && isAbsolute(options.configuredPath)) {
    if (await validatesPi(options.configuredPath, run))
      return { path: options.configuredPath, ready: true }
    return {
      message: `The configured Pi executable could not be validated: ${options.configuredPath}`,
      ready: false,
    }
  }

  const fromShell = await loginShellPiPath(run)
  if (fromShell && await validatesPi(fromShell, run)) return { path: fromShell, ready: true }

  if (platform === 'darwin') {
    for (const path of ['/opt/homebrew/bin/pi', '/usr/local/bin/pi']) {
      if (await validatesPi(path, run)) return { path, ready: true }
    }
  }

  return { message: missingPiMessage, ready: false }
}

async function loginShellPiPath(
  run: (command: string, args: string[]) => Promise<CommandResult>,
): Promise<string | undefined> {
  try {
    const result = await run('/bin/zsh', ['-l', '-c', 'command -v pi'])
    const path = result.stdout.split(/\r?\n/, 1)[0]?.trim()
    return result.code === 0 && path && isAbsolute(path) ? path : undefined
  } catch {
    return undefined
  }
}

async function validatesPi(
  path: string,
  run: (command: string, args: string[]) => Promise<CommandResult>,
): Promise<boolean> {
  try {
    return (await run(path, ['--version'])).code === 0
  } catch {
    return false
  }
}

function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'ignore'] })
    let stdout = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.once('error', () => resolve({ code: 1, stdout: '' }))
    child.once('close', (code) => resolve({ code: code ?? 1, stdout }))
  })
}
