/** Splits a workspace path into its parent directory and basename.
 *
 * The result preserves the original separator style (Unix `/` or Windows `\\`) in
 * the parent path. Edge cases such as root directories (`/`, `C:\\`), home
 * references (`~`, `~user`) and relative entries (`.`, `..`) are handled so the
 * basename always contains the meaningful rightmost component.
 */
export function splitWorkspacePath(path: string): { parent: string; basename: string } {
  if (!path) return { parent: '', basename: '' }

  const normalized = path.replace(/\\/g, '/')
  const usesBackslash = path.includes('\\')

  const isRoot = /^\/$|^[a-zA-Z]:\/?$/.test(normalized)
  if (isRoot) return { parent: '', basename: path }

  const trimmed = normalized.replace(/\/+$/, '')
  const lastSlash = trimmed.lastIndexOf('/')
  if (lastSlash === -1) return { parent: '', basename: path }

  let parent = trimmed.slice(0, lastSlash)
  if (parent === '') parent = '/'
  if (usesBackslash) parent = parent.replace(/\//g, '\\')

  const basename = trimmed.slice(lastSlash + 1)
  return { parent, basename }
}
