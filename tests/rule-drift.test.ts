import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { plan, writePlannedFiles } from '../src/generator.js'
import { loadRuleManifest, parseRuleManifest, checkRuleDrift } from '../src/rules.js'

const SKILLS_DIR = join(import.meta.dirname, '..', 'skills')

const projectInfo = {
  projectName: 'drift-suite',
  baseUrl: 'https://staging.example.com',
  fixtureImportPath: '',
  pageObjectsDir: 'src/pages',
  testDir: 'src/tests',
}

function generate(platforms: string[], packs: string[], meetsMinPlaywrightVersion = true): string {
  const cwd = mkdtempSync(join(tmpdir(), 'wico-drift-'))
  writePlannedFiles(plan({ platforms, packs, projectInfo, cwd, meetsMinPlaywrightVersion, generatorVersion: '2.1.0-test' }))
  return cwd
}

test('the manifest has rules and every one of them names a real owner', () => {
  const manifest = loadRuleManifest(SKILLS_DIR)
  assert.ok(manifest.length > 0, 'the manifest is empty')
  for (const rule of manifest) {
    assert.match(rule.owner, /\.md$/, `owner must be a reference file: ${rule.owner}`)
    assert.notEqual(rule.anchor.trim(), '')
  }
})

test('no rule has drifted, in any platform × pack × version combination', () => {
  const manifest = loadRuleManifest(SKILLS_DIR)
  for (const platforms of [['claude'], ['cursor'], ['copilot'], ['agents'], ['claude', 'cursor', 'copilot', 'agents']]) {
    for (const packs of [['core'], ['core', 'templates']]) {
      for (const meetsMinPlaywrightVersion of [true, false]) {
        const cwd = generate(platforms, packs, meetsMinPlaywrightVersion)
        const label = `${platforms.join('+')} / ${packs.join('+')} / pw159=${meetsMinPlaywrightVersion}`
        try {
          const issues = checkRuleDrift(cwd, manifest)
          assert.deepEqual(issues, [], `${label}:\n${issues.map(i => `  ${i.file}: ${i.message}`).join('\n')}`)
        } finally {
          rmSync(cwd, { recursive: true, force: true })
        }
      }
    }
  }
})

test('a rule dropped from a summary is reported against that summary', () => {
  const manifest = loadRuleManifest(SKILLS_DIR)
  const cwd = generate(['claude', 'cursor', 'copilot'], ['core', 'templates'])
  try {
    const rule = join(cwd, '.cursor', 'rules', 'playwright-e2e.mdc')
    const stripped = readFileSync(rule, 'utf-8')
      .split('\n')
      .filter(line => !line.includes('page.waitForTimeout()'))
      .join('\n')
    writeFileSync(rule, stripped)

    const issues = checkRuleDrift(cwd, manifest)
    assert.ok(
      issues.some(i => i.file === '.cursor/rules/playwright-e2e.mdc' && i.message.includes('page.waitForTimeout()')),
      `expected the Cursor rule to be reported, got:\n${issues.map(i => `  ${i.file}: ${i.message}`).join('\n')}`,
    )
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('a rule dropped from the reference that owns it is reported against the reference', () => {
  const manifest = loadRuleManifest(SKILLS_DIR)
  const cwd = generate(['claude'], ['core'])
  try {
    const owner = join(cwd, '.claude', 'skills', 'playwright-e2e', 'references', 'conventions.md')
    writeFileSync(owner, readFileSync(owner, 'utf-8').split('\n').filter(l => !l.includes('XPath')).join('\n'))

    const issues = checkRuleDrift(cwd, manifest)
    assert.ok(
      issues.some(i => i.file.endsWith('references/conventions.md') && i.message.includes('XPath')),
      `expected the owning reference to be reported, got:\n${issues.map(i => `  ${i.file}: ${i.message}`).join('\n')}`,
    )
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('a surface whose platform was not selected is not reported', () => {
  const manifest = loadRuleManifest(SKILLS_DIR)
  const cwd = generate(['claude'], ['core'])
  try {
    assert.deepEqual(checkRuleDrift(cwd, manifest), [], 'Cursor and Copilot files do not exist here and must be skipped')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('the manifest parser rejects malformed rows', () => {
  assert.throws(() => parseRuleManifest('anchor\towner.md\tcursor'), /separated by tabs/)
  assert.throws(() => parseRuleManifest('anchor\towner.md\tnotaplatform\tlabel'), /unknown surface/)
  assert.deepEqual(parseRuleManifest('# a comment\n\nanchor\towner.md\t-\tlabel\n'), [
    { anchor: 'anchor', owner: 'owner.md', surfaces: [], label: 'label' },
  ])
})
