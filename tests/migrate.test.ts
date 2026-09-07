import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { detectLegacyOutputs, removeLegacyOutputs, LEGACY_CURSOR_RULE_DESCRIPTIONS } from '../src/migrate.js'
import type { PlannedFile } from '../src/generator.js'

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function planned(path: string): PlannedFile {
  return { path, content: '', exists: false, status: 'new', mode: 'replace' }
}

const LEGACY_INDEX = '# Playwright E2E Skills\n\n## Decision Tree\n\n...\n'
const OUR_INDEX = '---\nname: playwright-e2e\ndescription: x\nmetadata:\n  generator: wico-playwright-agent-skills\n  generator-version: 2.0.0\n---\n\n# Playwright E2E Skills\n'

test('detects every kind of 1.x output and nothing else', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'wico-migrate-'))
  try {
    // 1.x generic output
    write(join(cwd, '.agent-skills', 'SKILL.md'), LEGACY_INDEX)
    write(join(cwd, '.agent-skills', 'references', 'playwright-patterns.md'), '# x')
    // 1.x per-skill cursor rules: one genuine, one edited by hand, one unrelated
    write(join(cwd, '.cursor', 'rules', 'test-review.mdc'), `---\ndescription: ${LEGACY_CURSOR_RULE_DESCRIPTIONS['test-review']}\nglobs: **/*.spec.ts\n---\n# x`)
    write(join(cwd, '.cursor', 'rules', 'data-strategy.mdc'), '---\ndescription: My own data rules\nglobs: **/*.spec.ts\n---\n# mine')
    write(join(cwd, '.cursor', 'rules', 'react.mdc'), '---\ndescription: React rules\n---\n# react')
    // Our claude skill dir with one stale reference
    const claudeSkill = join(cwd, '.claude', 'skills', 'playwright-e2e')
    write(join(claudeSkill, 'SKILL.md'), OUR_INDEX)
    write(join(claudeSkill, 'references', 'playwright-patterns.md'), '# keep')
    write(join(claudeSkill, 'references', 'test-planning.md'), '# stale')
    // A skill dir we are not generating for this run: must be left alone
    const agentsSkill = join(cwd, '.agents', 'skills', 'playwright-e2e')
    write(join(agentsSkill, 'SKILL.md'), OUR_INDEX)
    write(join(agentsSkill, 'references', 'old.md'), '# not ours to judge this run')
    // Someone else's skill with our name but no marker: never touched
    write(join(cwd, '.claude', 'skills', 'other-skill', 'references', 'x.md'), '# x')
    // 1.x vendored playwright-cli copy
    write(join(cwd, '.claude', 'skills', 'playwright-cli', 'SKILL.md'), '# Browser Automation\n\n### CLI Debug & Trace Analysis (Playwright v1.59+)\n')
    write(join(cwd, '.claude', 'skills', 'playwright-cli', 'references', 'tracing.md'), '# t')
    // An official install elsewhere must not be flagged
    write(join(cwd, '.agents', 'skills', 'playwright-cli', 'SKILL.md'), '# official\n* [x](references/playwright-tests.md)\n* [y](references/request-mocking.md)\n')

    const plan = [
      planned(join(claudeSkill, 'SKILL.md')),
      planned(join(claudeSkill, 'references', 'playwright-patterns.md')),
    ]
    const items = detectLegacyOutputs(cwd, plan)
    const paths = items.map(item => item.path).sort()
    assert.deepEqual(paths, [
      join(cwd, '.agent-skills'),
      join(claudeSkill, 'references', 'test-planning.md'),
      join(cwd, '.claude', 'skills', 'playwright-cli'),
      join(cwd, '.cursor', 'rules', 'test-review.mdc'),
    ].sort())

    const removed = removeLegacyOutputs(items)
    assert.equal(removed.length, 4)
    assert.ok(!existsSync(join(cwd, '.agent-skills')))
    assert.ok(!existsSync(join(claudeSkill, 'references', 'test-planning.md')))
    assert.ok(existsSync(join(claudeSkill, 'references', 'playwright-patterns.md')))
    assert.ok(!existsSync(join(cwd, '.claude', 'skills', 'playwright-cli')))
    assert.ok(!existsSync(join(cwd, '.cursor', 'rules', 'test-review.mdc')))
    assert.ok(existsSync(join(cwd, '.cursor', 'rules', 'data-strategy.mdc')))
    assert.ok(existsSync(join(cwd, '.cursor', 'rules', 'react.mdc')))
    assert.ok(existsSync(join(agentsSkill, 'references', 'old.md')))
    assert.ok(existsSync(join(cwd, '.agents', 'skills', 'playwright-cli', 'SKILL.md')))
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('a 1.x claude index without frontmatter still counts as ours', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'wico-migrate-'))
  try {
    const skill = join(cwd, '.claude', 'skills', 'playwright-e2e')
    write(join(skill, 'SKILL.md'), LEGACY_INDEX)
    write(join(skill, 'references', 'gone.md'), '# stale')
    const items = detectLegacyOutputs(cwd, [planned(join(skill, 'SKILL.md'))])
    assert.deepEqual(items.map(item => item.path), [join(skill, 'references', 'gone.md')])
    removeLegacyOutputs(items)
    assert.ok(!existsSync(join(skill, 'references')), 'empty references dir is pruned')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('a vendored copy is recognised by the missing playwright-tests reference too', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'wico-migrate-'))
  try {
    write(join(cwd, '.claude', 'skills', 'playwright-cli', 'SKILL.md'), '# x\n* **Request mocking** [r](references/request-mocking.md)\n')
    const items = detectLegacyOutputs(cwd)
    assert.equal(items.length, 1)
    assert.ok(items[0].reason.includes('looks like'))
    rmSync(join(cwd, '.claude', 'skills', 'playwright-cli'), { recursive: true })
    write(join(cwd, '.claude', 'skills', 'playwright-cli', 'SKILL.md'), '# x\n* [a](references/playwright-tests.md)\n* [r](references/request-mocking.md)\n')
    assert.deepEqual(detectLegacyOutputs(cwd), [])
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('an empty project has nothing to migrate', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'wico-migrate-'))
  try {
    assert.deepEqual(detectLegacyOutputs(cwd), [])
    assert.deepEqual(removeLegacyOutputs([]), [])
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
