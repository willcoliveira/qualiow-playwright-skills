import { lstatSync, realpathSync, statSync, type Stats } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

/**
 * Every path we write or remove sits under the project directory, and a project
 * is not trusted: a cloned repository can ship `.claude/skills/playwright-e2e`
 * as a symlink to `~`, or `references/x.md` as a dangling symlink to a shell
 * startup file. `writeFileSync` and `mkdirSync` follow both, so without this
 * check `init` writes outside the project while listing only in-project paths.
 *
 * A symlink is allowed when it resolves inside the project (a monorepo sharing
 * one skill tree between two roots), and refused when it resolves anywhere else
 * or nowhere. A file with more than one hard link is refused too, since writing
 * it changes every other name it has.
 *
 * An existing target must be a regular file, or a directory where legacy
 * removal expects one. The plan reads a target before it writes it, to tell
 * changed from unchanged, so a named pipe or a device there would block or
 * divert that read; it is refused before anything opens it.
 */
export class UnsafePathError extends Error {}

export function assertInsideProject(root: string, target: string): void {
  const absRoot = resolve(root)
  const absTarget = resolve(target)
  const rel = relative(absRoot, absTarget)
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new UnsafePathError(`Refusing to touch ${target}: it is outside the project directory ${absRoot}`)
  }

  const realRoot = realpathSync(absRoot)
  let current = absRoot
  for (const part of rel.split(sep)) {
    current = join(current, part)
    let stat
    try {
      stat = lstatSync(current)
    } catch {
      return // does not exist yet; everything below it is created inside the project
    }
    if (stat.isSymbolicLink()) {
      let real: string
      try {
        real = realpathSync(current)
      } catch {
        throw new UnsafePathError(`Refusing to write through ${relative(absRoot, current)}: it is a symlink to a path that does not exist`)
      }
      if (!isInside(realRoot, real)) {
        throw new UnsafePathError(`Refusing to write through ${relative(absRoot, current)}: it is a symlink to ${real}, outside the project`)
      }
      if (current === absTarget) assertFileOrDirectory(statSync(real), relative(absRoot, current))
    } else if (current === absTarget) {
      assertFileOrDirectory(stat, relative(absRoot, current))
      if (stat.isFile() && stat.nlink > 1) {
        throw new UnsafePathError(`Refusing to write ${relative(absRoot, current)}: it is hard-linked to ${stat.nlink - 1} other path(s)`)
      }
    }
  }
}

function assertFileOrDirectory(stat: Stats, label: string): void {
  if (!stat.isFile() && !stat.isDirectory()) {
    throw new UnsafePathError(`Refusing to touch ${label}: it is not a regular file or directory`)
  }
}

export function isInsideProject(root: string, target: string): boolean {
  try {
    assertInsideProject(root, target)
    return true
  } catch (err) {
    if (err instanceof UnsafePathError) return false
    throw err
  }
}

function isInside(realRoot: string, real: string): boolean {
  const rel = relative(realRoot, real)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}
