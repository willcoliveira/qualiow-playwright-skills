import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Reads the package version from package.json so the CLI banner never
 * drifts from the published version. Falls back gracefully if the file
 * cannot be located (e.g. unusual install layouts).
 */
export function getVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  // Running from source: src/version.ts → ../package.json
  // Running from bundle: dist/bin/init.js → ../../package.json
  const candidates = [
    join(here, '..', 'package.json'),
    join(here, '..', '..', 'package.json'),
  ]

  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(candidate, 'utf-8'))
      if (pkg.name === 'wico-playwright-agent-skills' && pkg.version) {
        return pkg.version
      }
    } catch {}
  }

  return 'unknown'
}
