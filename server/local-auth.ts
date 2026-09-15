import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

/** Accepts browser development without a secret and otherwise verifies an exact bearer token. */
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
