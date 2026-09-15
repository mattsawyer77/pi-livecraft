import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const flake = readFileSync(new URL('../flake.nix', import.meta.url), 'utf8')

test('defines a pinned Nix desktop package without downloading Electron', () => {
  assert.match(flake, /nixpkgs\.url/)
  assert.match(flake, /nodejs_24/)
  assert.match(flake, /buildNpmPackage/)
  assert.match(flake, /ELECTRON_SKIP_BINARY_DOWNLOAD\s*=\s*"1"/)
  assert.match(flake, /electronDist/)
  assert.match(flake, /aarch64-darwin/)
  assert.equal(flake.includes('-name \'*.zip\''), true)
  assert.equal(flake.includes('pi-coding-agent'), false)
})
