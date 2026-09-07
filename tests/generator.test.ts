import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { plan, writePlannedFiles, listPackFiles, withRequiredPacks } from '../src/generator.js'
import { parseFrontmatter } from '../src/frontmatter.js'
import { findUnrenderedTemplate } from '../src/template-engine.js'

const projectInfo = {
  projectName: 'my-suite',
  baseUrl: 'https://staging.example.com',
  fixtureImportPath: '',
  pageObjectsDir: 'src/pages',
  testDir: 'src/tests',
}

function makeOptions(cwd: string, platforms: string[], packs: string[], meetsMinPlaywrightVersion = true) {
  return { platforms, packs, projectInfo, cwd, meetsMinPlaywrightVersion, generatorVersion: '2.0.0-test' }
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'wico-gen-'))
}

function walk(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name))
}

test('plan is a dry run — it writes nothing', () => {
  const cwd = tempDir()
  try {
    const planned = plan(makeOptions(cwd, ['claude'], ['core']))
    assert.ok(planned.length > 0)
    assert.ok(!existsSync(join(cwd, '.claude')))
    assert.ok(planned.every(f => !f.exists && f.status === 'new'))
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('plan + write generates the 2.0 layout for every platform and pack', () => {
  const cwd = tempDir()
  try {
    const planned = plan(makeOptions(cwd, ['claude', 'cursor', 'copilot', 'generic'], ['core', 'playwright-cli', 'templates']))
    const written = writePlannedFiles(planned)
    assert.equal(written.length, planned.length)

    const claude = join(cwd, '.claude', 'skills', 'playwright-e2e')
    const agents = join(cwd, '.agents', 'skills', 'playwright-e2e')
    assert.ok(existsSync(join(claude, 'SKILL.md')))
    assert.ok(existsSync(join(agents, 'SKILL.md')))
    assert.ok(existsSync(join(cwd, '.cursor', 'rules', 'playwright-e2e.mdc')))
    assert.ok(existsSync(join(cwd, '.github', 'instructions', 'playwright-e2e.instructions.md')))
    assert.ok(existsSync(join(cwd, '.github', 'copilot-instructions.md')))

    // 1.x paths are gone
    assert.ok(!existsSync(join(cwd, '.agent-skills')))
    assert.ok(!existsSync(join(cwd, '.cursor', 'rules', 'playwright-patterns.mdc')))
    // The playwright-cli pack never writes files: Playwright's installer owns those paths
    assert.ok(!existsSync(join(cwd, '.claude', 'skills', 'playwright-cli')))
    assert.ok(!existsSync(join(cwd, '.agents', 'skills', 'playwright-cli')))

    // Same reference set for both skill roots, one file per core/template source
    const claudeRefs = readdirSync(join(claude, 'references')).sort()
    const agentsRefs = readdirSync(join(agents, 'references')).sort()
    assert.deepEqual(claudeRefs, agentsRefs)
    assert.deepEqual(claudeRefs, [...listPackFiles(join('skills', 'core')), ...listPackFiles(join('skills', 'templates'))].sort())

    // Every generated file is fully rendered
    for (const file of walk(cwd)) {
      const content = readFileSync(file, 'utf-8')
      assert.equal(findUnrenderedTemplate(content), null, `unrendered template in ${file}`)
    }

    // SKILL.md carries spec frontmatter plus our ownership marker
    const { data } = parseFrontmatter(readFileSync(join(claude, 'SKILL.md'), 'utf-8'))
    assert.equal(data.name, 'playwright-e2e')
    assert.ok(typeof data.description === 'string' && data.description.includes('my-suite'))
    assert.deepEqual(data.metadata, { generator: 'wico-playwright-agent-skills', 'generator-version': '2.0.0-test' })
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('the shared .agents/skills tree is planned once across cursor, copilot and agents', () => {
  const cwd = tempDir()
  try {
    const planned = plan(makeOptions(cwd, ['cursor', 'copilot', 'agents'], ['core']))
    const indexes = planned.filter(f => f.path.endsWith(join('playwright-e2e', 'SKILL.md')))
    assert.equal(indexes.length, 1)
    const paths = planned.map(f => f.path)
    assert.equal(new Set(paths).size, paths.length, 'no duplicate paths')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('core is always included, and pack selection changes the index', () => {
  assert.deepEqual(withRequiredPacks(['templates']), ['core', 'templates'])
  assert.deepEqual(withRequiredPacks(['core', 'core']), ['core'])

  const cwd = tempDir()
  try {
    const coreOnly = plan(makeOptions(cwd, ['claude'], ['templates']))
    assert.ok(coreOnly.some(f => f.path.endsWith('playwright-patterns.md')), 'core references present even when only templates requested')

    const index = (packs: string[]) => plan(makeOptions(cwd, ['claude'], packs)).find(f => f.path.endsWith('SKILL.md'))!.content
    assert.ok(index(['core', 'templates']).includes('references/test-planning.md'))
    assert.ok(!index(['core']).includes('references/test-planning.md'))
    assert.ok(!index(['core']).includes('references/project-conventions.md'))
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('re-planning reports unchanged files and writing skips them', () => {
  const cwd = tempDir()
  try {
    const first = plan(makeOptions(cwd, ['claude', 'copilot'], ['core', 'templates']))
    writePlannedFiles(first)

    const second = plan(makeOptions(cwd, ['claude', 'copilot'], ['core', 'templates']))
    assert.ok(second.every(f => f.exists && f.status === 'unchanged'), 'everything unchanged on an identical re-run')
    assert.deepEqual(writePlannedFiles(second), [])

    // A hand-edited file shows up as modified and is the only thing rewritten
    const target = second.find(f => f.path.endsWith('playwright-patterns.md'))!
    writeFileSync(target.path, '# edited by hand\n')
    const third = plan(makeOptions(cwd, ['claude', 'copilot'], ['core', 'templates']))
    const modified = third.filter(f => f.status === 'modified')
    assert.deepEqual(modified.map(f => f.path), [target.path])
    assert.deepEqual(writePlannedFiles(third), [target.path])
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('re-running copilot generation does not duplicate the marker block', () => {
  const cwd = tempDir()
  try {
    writePlannedFiles(plan(makeOptions(cwd, ['copilot'], ['core'])))
    writePlannedFiles(plan(makeOptions(cwd, ['copilot'], ['core'])))

    const content = readFileSync(join(cwd, '.github', 'copilot-instructions.md'), 'utf-8')
    assert.equal(content.split('<!-- wico-playwright-agent-skills:start -->').length - 1, 1)
    assert.equal(content.split('## Playwright E2E testing').length - 1, 1)
    assert.ok(content.length < 2000, 'copilot-instructions.md is a short pointer block, not the whole skill')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('the copilot block replaces a 1.x block and keeps hand-written content', () => {
  const cwd = tempDir()
  try {
    const file = join(cwd, '.github', 'copilot-instructions.md')
    const legacy = '# Team rules\n\nBe kind.\n\n<!-- wico-playwright-agent-skills:start -->\n\n# Playwright E2E Testing Guidelines\n\n(huge 1.x content)\n\n<!-- wico-playwright-agent-skills:end -->\n\nMore of my own notes.\n'
    mkdirSync(join(cwd, '.github'), { recursive: true })
    writeFileSync(file, legacy)

    const planned = plan(makeOptions(cwd, ['copilot'], ['core']))
    const copilot = planned.find(f => f.path === file)!
    assert.equal(copilot.status, 'modified')
    assert.equal(copilot.mode, 'merge')
    writePlannedFiles(planned)

    const content = readFileSync(file, 'utf-8')
    assert.ok(content.startsWith('# Team rules'))
    assert.ok(content.trimEnd().endsWith('More of my own notes.'))
    assert.ok(!content.includes('huge 1.x content'))
    assert.ok(content.includes('.agents/skills/playwright-e2e/SKILL.md'))
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('plan rejects unknown platforms and packs', () => {
  const cwd = tempDir()
  try {
    assert.throws(() => plan(makeOptions(cwd, ['vscode-unknown'], ['core'])), /Unknown platform/)
    assert.throws(() => plan(makeOptions(cwd, ['claude'], ['nope'])), /Unknown pack/)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
