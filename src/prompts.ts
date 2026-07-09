import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

export interface ProjectDetection {
  hasPlaywrightConfig: boolean
  isTypeScript: boolean
  playwrightVersion: string | null
  meetsMinVersion: boolean
  cwd: string
}

const MIN_PLAYWRIGHT_VERSION = '1.59.0'

export async function detectProject(cwd = process.cwd()): Promise<ProjectDetection> {
  const hasPlaywrightConfig =
    existsSync(join(cwd, 'playwright.config.ts')) ||
    existsSync(join(cwd, 'playwright.config.js')) ||
    existsSync(join(cwd, 'playwright.config.mts'))

  const isTypeScript =
    existsSync(join(cwd, 'tsconfig.json')) ||
    existsSync(join(cwd, 'playwright.config.ts'))

  const playwrightVersion = detectPlaywrightVersion(cwd)
  const meetsMinVersion = playwrightVersion !== null && compareVersions(playwrightVersion, MIN_PLAYWRIGHT_VERSION) >= 0

  return {
    hasPlaywrightConfig,
    isTypeScript,
    playwrightVersion,
    meetsMinVersion,
    cwd,
  }
}

function detectPlaywrightVersion(cwd: string): string | null {
  // Try reading from node_modules package.json first
  const pkgPath = join(cwd, 'node_modules', '@playwright', 'test', 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      if (pkg.version) return pkg.version
    } catch {}
  }

  // Fallback: ask the locally installed playwright CLI.
  // --no-install guarantees detection never triggers a network download.
  try {
    const output = execSync('npx --no-install playwright --version', { cwd, timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'] })
    const match = output.toString().trim().match(/(\d+\.\d+\.\d+)/)
    if (match) return match[1]
  } catch {}

  return null
}

export function compareVersions(a: string, b: string): number {
  // Strip pre-release/build suffixes ("1.60.0-beta.1" → "1.60.0")
  const parse = (v: string) => v.split(/[-+]/)[0].split('.').map(part => {
    const n = Number(part)
    return Number.isFinite(n) ? n : 0
  })
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}
