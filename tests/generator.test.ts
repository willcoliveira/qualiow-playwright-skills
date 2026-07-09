import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { plan, writePlannedFiles } from '../src/generator.js'

const projectInfo = {
  projectName: 'my-suite',
  baseUrl: 'https://staging.example.com',
  fixtureImportPath: '',
  pageObjectsDir: 'src/pages',
  testDir: 'src/tests',
}

function makeOptions(cwd: string, platforms: string[], packs: string[]) {
  return { platforms, packs, projectInfo, cwd, meetsMinPlaywrightVersion: true }
}

test('plan is a dry run — it writes nothing', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'wico-test-'))
  try {
    const planned = plan(makeOptions(cwd, ['claude'], ['core']))
    assert.ok(planned.length > 0)
    assert.ok(!existsSync(join(cwd, '.claude')))
    assert.ok(planned.every(f => !f.exists))
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('plan + write generates all files for every platform and pack', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'wico-test-'))
  try {
    const planned = plan(makeOptions(cwd, ['claude', 'cursor', 'copilot', 'generic'], ['core', 'playwright-cli', 'templates']))
    const written = writePlannedFiles(planned)

    assert.equal(written.length, planned.length)
    for (const file of written) {
      assert.ok(existsSync(file), `missing: ${file}`)
    }

    // Spot-check key outputs per platform
    assert.ok(existsSync(join(cwd, '.claude', 'skills', 'playwright-e2e', 'SKILL.md')))
    assert.ok(existsSync(join(cwd, '.claude', 'skills', 'playwright-cli', 'SKILL.md')))
    assert.ok(existsSync(join(cwd, '.cursor', 'rules', 'playwright-e2e.mdc')))
    assert.ok(existsSync(join(cwd, '.github', 'copilot-instructions.md')))
    assert.ok(existsSync(join(cwd, '.agent-skills', 'SKILL.md')))

    // Templates must have placeholders resolved
    const skillMd = readFileSync(join(cwd, '.claude', 'skills', 'playwright-e2e', 'SKILL.md'), 'utf-8')
    assert.ok(!skillMd.includes('{{PROJECT_NAME}}'))
    assert.ok(!skillMd.includes('{{BASE_URL}}'))
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('re-planning after a write flags existing files', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'wico-test-'))
  try {
    const first = plan(makeOptions(cwd, ['claude'], ['core']))
    writePlannedFiles(first)

    const second = plan(makeOptions(cwd, ['claude'], ['core']))
    assert.ok(second.every(f => f.exists))
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('re-running copilot generation does not duplicate content', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'wico-test-'))
  try {
    writePlannedFiles(plan(makeOptions(cwd, ['copilot'], ['core'])))
    writePlannedFiles(plan(makeOptions(cwd, ['copilot'], ['core'])))

    const content = readFileSync(join(cwd, '.github', 'copilot-instructions.md'), 'utf-8')
    const headerCount = content.split('# Detailed Skill References').length - 1
    assert.equal(headerCount, 1)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('plan rejects unknown platforms', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'wico-test-'))
  try {
    assert.throws(() => plan(makeOptions(cwd, ['vscode-unknown'], ['core'])), /Unknown platform/)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
