import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compareVersions, detectProject, versionFromRange } from '../src/detect.js'

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'wico-detect-'))
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2))
}

test('compares plain versions', () => {
  assert.ok(compareVersions('1.59.0', '1.59.0') === 0)
  assert.ok(compareVersions('1.60.1', '1.59.0') > 0)
  assert.ok(compareVersions('1.58.9', '1.59.0') < 0)
  assert.ok(compareVersions('2.0.0', '1.99.99') > 0)
})

test('pre-releases sort below the release and never poison with NaN', () => {
  assert.ok(compareVersions('1.60.0-beta.1', '1.59.0') > 0)
  assert.ok(compareVersions('1.58.0-alpha', '1.59.0') < 0)
  assert.ok(compareVersions('1.59.0-beta.1', '1.59.0') < 0)
  assert.ok(compareVersions('1.59.0', '1.59.0-beta.1') > 0)
  assert.ok(compareVersions('1.59.0-beta.2', '1.59.0-beta.1') > 0)
  assert.ok(compareVersions('1.59.0+build.5', '1.59.0') === 0)
  assert.ok(compareVersions('v1.59.0', '1.59.0') === 0)
})

test('handles short versions', () => {
  assert.ok(compareVersions('1.59', '1.59.0') === 0)
  assert.ok(compareVersions('2', '1.59.0') > 0)
})

test('versionFromRange extracts a usable version or nothing', () => {
  assert.equal(versionFromRange('^1.59.0'), '1.59.0')
  assert.equal(versionFromRange('~1.60'), '1.60.0')
  assert.equal(versionFromRange('>=1.59.0-beta.1 <2'), '1.59.0-beta.1')
  assert.equal(versionFromRange('*'), null)
  assert.equal(versionFromRange('latest'), null)
  assert.equal(versionFromRange(undefined), null)
})

test('detects an installed @playwright/test at the project root', () => {
  const cwd = tempDir()
  try {
    writeJson(join(cwd, 'package.json'), { name: 'shop-e2e', devDependencies: { '@playwright/test': '^1.40.0' } })
    writeJson(join(cwd, 'node_modules', '@playwright', 'test', 'package.json'), { name: '@playwright/test', version: '1.62.1' })
    writeFileSync(join(cwd, 'playwright.config.mts'), 'export default {}')

    const detection = detectProject(cwd)
    assert.equal(detection.packageName, 'shop-e2e')
    assert.equal(detection.playwrightConfig, 'playwright.config.mts')
    assert.equal(detection.isTypeScript, true)
    assert.deepEqual(detection.playwright, { name: '@playwright/test', version: '1.62.1', source: 'installed' })
    assert.equal(detection.meetsMinVersion, true)
    assert.equal(detection.hasBundledCli, true)
    assert.equal(detection.playwrightCli, null)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('finds a hoisted install one level up (monorepo) and the standalone CLI', () => {
  const root = tempDir()
  try {
    const cwd = join(root, 'packages', 'app')
    writeJson(join(cwd, 'package.json'), { name: 'app' })
    writeJson(join(root, 'node_modules', 'playwright', 'package.json'), { name: 'playwright', version: '1.59.0' })
    writeJson(join(root, 'node_modules', '@playwright', 'cli', 'package.json'), { name: '@playwright/cli', version: '0.4.0' })
    writeFileSync(join(cwd, 'playwright.config.js'), 'module.exports = {}')

    const detection = detectProject(cwd)
    assert.equal(detection.playwrightConfig, 'playwright.config.js')
    assert.equal(detection.isTypeScript, false)
    assert.deepEqual(detection.playwright, { name: 'playwright', version: '1.59.0', source: 'installed' })
    assert.deepEqual(detection.playwrightCli, { name: '@playwright/cli', version: '0.4.0', source: 'installed' })
    assert.equal(detection.meetsMinVersion, true)
    assert.equal(detection.hasBundledCli, false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('resolves through an exports map that hides package.json', () => {
  const cwd = tempDir()
  try {
    writeJson(join(cwd, 'package.json'), { name: 'app' })
    const pkgDir = join(cwd, 'node_modules', '@playwright', 'test')
    writeJson(join(pkgDir, 'package.json'), { name: '@playwright/test', version: '1.61.0', exports: { '.': './index.js' } })
    writeFileSync(join(pkgDir, 'index.js'), 'module.exports = {}')

    const detection = detectProject(cwd)
    assert.deepEqual(detection.playwright, { name: '@playwright/test', version: '1.61.0', source: 'installed' })
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('falls back to the package.json range when nothing is installed', () => {
  const cwd = tempDir()
  try {
    writeJson(join(cwd, 'package.json'), { name: 'app', dependencies: { '@playwright/test': '~1.58.2' } })
    const detection = detectProject(cwd)
    assert.deepEqual(detection.playwright, { name: '@playwright/test', version: '1.58.2', source: 'range' })
    assert.equal(detection.meetsMinVersion, false)
    assert.equal(detection.playwrightConfig, null)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('a pre-release of the minimum version does not qualify', () => {
  const cwd = tempDir()
  try {
    writeJson(join(cwd, 'node_modules', '@playwright', 'test', 'package.json'), { name: '@playwright/test', version: '1.59.0-beta.1' })
    const detection = detectProject(cwd)
    assert.equal(detection.playwright?.version, '1.59.0-beta.1')
    assert.equal(detection.meetsMinVersion, false)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('an empty directory yields no detections and no package name', () => {
  const cwd = tempDir()
  try {
    const detection = detectProject(cwd)
    assert.equal(detection.packageName, null)
    assert.equal(detection.playwright, null)
    assert.equal(detection.playwrightCli, null)
    assert.equal(detection.meetsMinVersion, false)
    assert.equal(detection.hasBundledCli, false)
    assert.equal(detection.isTypeScript, false)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
