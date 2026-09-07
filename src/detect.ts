import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

/** `npx playwright test --debug=cli`, `browser.bind()`, `npx playwright trace`. */
export const MIN_AGENT_DEBUG_VERSION = '1.59.0'
/** `npx playwright cli` / `npx playwright mcp` are bundled with the test runner. */
export const MIN_BUNDLED_CLI_VERSION = '1.62.0'

export const PLAYWRIGHT_CONFIG_NAMES = [
  'playwright.config.ts',
  'playwright.config.mts',
  'playwright.config.cts',
  'playwright.config.js',
  'playwright.config.mjs',
  'playwright.config.cjs',
] as const

export interface DetectedPackage {
  name: string
  version: string
  /** `installed`: read from node_modules. `range`: only a package.json range, not installed. */
  source: 'installed' | 'range'
}

export interface ProjectDetection {
  cwd: string
  /** `name` from `<cwd>/package.json`, when readable. */
  packageName: string | null
  /** The config file that was found, e.g. `playwright.config.mts`. */
  playwrightConfig: string | null
  isTypeScript: boolean
  /** `@playwright/test` or `playwright`. */
  playwright: DetectedPackage | null
  /** Standalone `@playwright/cli`. */
  playwrightCli: DetectedPackage | null
  /** Playwright >= 1.59 stable: `--debug=cli`, `playwright-cli attach`, `npx playwright trace`. */
  meetsMinVersion: boolean
  /** Playwright >= 1.62: `npx playwright cli install --skills` works without extra installs. */
  hasBundledCli: boolean
}

interface PackageJson {
  name?: unknown
  version?: unknown
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

/**
 * Detects the project synchronously and without executing anything from the
 * project: only the file system is consulted.
 */
export function detectProject(cwd = process.cwd()): ProjectDetection {
  const pkg = readPackageJson(join(cwd, 'package.json'))
  const playwrightConfig = PLAYWRIGHT_CONFIG_NAMES.find(name => existsSync(join(cwd, name))) ?? null
  const isTypeScript = existsSync(join(cwd, 'tsconfig.json')) || /\.[mc]?ts$/.test(playwrightConfig ?? '')

  const playwright = detectPackage(cwd, pkg, ['@playwright/test', 'playwright'])
  const playwrightCli = detectPackage(cwd, pkg, ['@playwright/cli'])

  return {
    cwd,
    packageName: typeof pkg?.name === 'string' && pkg.name !== '' ? pkg.name : null,
    playwrightConfig,
    isTypeScript,
    playwright,
    playwrightCli,
    meetsMinVersion: playwright !== null && compareVersions(playwright.version, MIN_AGENT_DEBUG_VERSION) >= 0,
    hasBundledCli: playwright !== null && compareVersions(playwright.version, MIN_BUNDLED_CLI_VERSION) >= 0,
  }
}

/**
 * Finds the first of `names` that resolves from `cwd` (walking up through
 * parent `node_modules`, so hoisted monorepo installs work), falling back to
 * the version range declared in the project's package.json.
 */
export function detectPackage(cwd: string, pkg: PackageJson | null, names: readonly string[]): DetectedPackage | null {
  const require = createRequire(join(cwd, 'package.json'))

  for (const name of names) {
    const installed = readInstalledPackage(require, name)
    if (installed) return { name, version: installed, source: 'installed' }
  }

  for (const name of names) {
    const range = pkg?.devDependencies?.[name] ?? pkg?.dependencies?.[name]
    const version = versionFromRange(range)
    if (version) return { name, version, source: 'range' }
  }

  return null
}

function readInstalledPackage(require: NodeJS.Require, name: string): string | null {
  // Fast path: packages that export ./package.json
  try {
    const version = readPackageJson(require.resolve(`${name}/package.json`))?.version
    if (typeof version === 'string') return version
  } catch {}

  // Packages with an `exports` map that hides package.json: resolve the entry
  // point and walk up to the package root.
  try {
    let dir = dirname(require.resolve(name))
    for (let i = 0; i < 10; i++) {
      const candidate = readPackageJson(join(dir, 'package.json'))
      if (candidate?.name === name && typeof candidate.version === 'string') return candidate.version
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  } catch {}

  return null
}

export function readPackageJson(path: string): PackageJson | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    return parsed !== null && typeof parsed === 'object' ? (parsed as PackageJson) : null
  } catch {
    return null
  }
}

/** `^1.59.0` → `1.59.0`, `~1.60` → `1.60.0`, `>=1.59.0-beta.1 <2` → `1.59.0-beta.1`; `*`/`latest`/tags → null. */
export function versionFromRange(range: string | undefined): string | null {
  if (!range) return null
  const match = /(\d+)\.(\d+)(?:\.(\d+))?(-[0-9A-Za-z.-]+)?/.exec(range)
  if (!match) return null
  return `${match[1]}.${match[2]}.${match[3] ?? '0'}${match[4] ?? ''}`
}

/**
 * Semver-style comparison: numeric core, then a pre-release version sorts
 * below the same release (`1.59.0-beta.1` < `1.59.0`). Missing parts are 0.
 */
export function compareVersions(a: string, b: string): number {
  const [coreA, preA] = splitPrerelease(a)
  const [coreB, preB] = splitPrerelease(b)
  for (let i = 0; i < 3; i++) {
    const diff = (coreA[i] ?? 0) - (coreB[i] ?? 0)
    if (diff !== 0) return diff
  }
  if (preA === null && preB === null) return 0
  if (preA === null) return 1
  if (preB === null) return -1
  return comparePrerelease(preA, preB)
}

function splitPrerelease(version: string): [number[], string | null] {
  const trimmed = version.trim().replace(/^v/, '')
  const plusIdx = trimmed.indexOf('+')
  const withoutBuild = plusIdx === -1 ? trimmed : trimmed.slice(0, plusIdx)
  const dashIdx = withoutBuild.indexOf('-')
  const core = dashIdx === -1 ? withoutBuild : withoutBuild.slice(0, dashIdx)
  const pre = dashIdx === -1 ? null : withoutBuild.slice(dashIdx + 1)
  const parts = core.split('.').map(part => {
    const n = Number(part)
    return Number.isFinite(n) ? n : 0
  })
  return [parts, pre]
}

function comparePrerelease(a: string, b: string): number {
  const pa = a.split('.')
  const pb = b.split('.')
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (pa[i] === undefined) return -1
    if (pb[i] === undefined) return 1
    const na = Number(pa[i])
    const nb = Number(pb[i])
    const bothNumeric = Number.isFinite(na) && Number.isFinite(nb) && pa[i] !== '' && pb[i] !== ''
    const diff = bothNumeric ? na - nb : pa[i].localeCompare(pb[i])
    if (diff !== 0) return diff
  }
  return 0
}
