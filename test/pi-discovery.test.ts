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
      if (command === '/bin/zsh') {
        assert.deepEqual(args, ['-l', '-c', 'command -v pi'])
        return { code: 0, stdout: '/opt/homebrew/bin/pi\n' }
      }
      assert.equal(command, '/opt/homebrew/bin/pi')
      assert.deepEqual(args, ['--version'])
      return { code: 0, stdout: 'pi 1.0.0' }
    },
  })
  assert.deepEqual(result, { path: '/opt/homebrew/bin/pi', ready: true })
})

test('returns a safe setup message when discovery fails', async () => {
  assert.deepEqual(
    await discoverPi({ run: async () => ({ code: 1, stdout: '' }) }),
    {
      message: 'Pi was not found. Install Pi or choose its executable path in Settings.',
      ready: false,
    },
  )
})
