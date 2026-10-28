import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getVersion } from '../src/version.js'

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'wico-version-'))
  try {
    fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function writePackage(dir: string, pkg: object): void {
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg))
}

test('reports the version in this repository\'s package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
  assert.equal(getVersion(), pkg.version)
})

test('finds package.json one level up, as when running from src/', () => {
  withTempDir((root) => {
    writePackage(root, { name: 'wico-playwright-agent-skills', version: '9.8.7' })
    const src = join(root, 'src')
    mkdirSync(src)
    assert.equal(getVersion(src), '9.8.7')
  })
})

test('finds package.json two levels up, as when running from dist/bin/', () => {
  withTempDir((root) => {
    writePackage(root, { name: 'wico-playwright-agent-skills', version: '1.2.3' })
    const bin = join(root, 'dist', 'bin')
    mkdirSync(bin, { recursive: true })
    assert.equal(getVersion(bin), '1.2.3')
  })
})

test('ignores a package.json that belongs to another package', () => {
  withTempDir((root) => {
    writePackage(root, { name: 'someone-elses-project', version: '5.0.0' })
    const src = join(root, 'src')
    mkdirSync(src)
    assert.equal(getVersion(src), 'unknown')
  })
})

test('falls back to "unknown" when package.json is missing or unreadable', () => {
  withTempDir((root) => {
    const src = join(root, 'src')
    mkdirSync(src)
    assert.equal(getVersion(src), 'unknown')
    writeFileSync(join(root, 'package.json'), '{ not json')
    assert.equal(getVersion(src), 'unknown')
  })
})
