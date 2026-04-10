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

  // Fallback: try npx playwright --version
  try {
    const output = execSync('npx playwright --version', { cwd, timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'] })
    const match = output.toString().trim().match(/(\d+\.\d+\.\d+)/)
    if (match) return match[1]
  } catch {}

  return null
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}
