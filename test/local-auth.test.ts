import assert from 'node:assert/strict'
import test from 'node:test'
import { authorizeLocalRequest } from '../server/local-auth.ts'

test('authorizes only the exact bearer token', () => {
  assert.equal(
    authorizeLocalRequest({ headers: { authorization: 'Bearer launch-secret' } }, 'launch-secret'),
    true,
  )
  assert.equal(
    authorizeLocalRequest({ headers: { authorization: 'Bearer wrong' } }, 'launch-secret'),
    false,
  )
  assert.equal(authorizeLocalRequest({ headers: {} }, 'launch-secret'), false)
})

test('allows browser development when no secret was configured', () => {
  assert.equal(authorizeLocalRequest({ headers: {} }, undefined), true)
})
