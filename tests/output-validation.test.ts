import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { plan, writePlannedFiles } from '../src/generator.js'
import { validateOutputTree, findRelativeReferences } from '../src/validate.js'

const PLATFORM_SETS = [['claude'], ['cursor'], ['copilot'], ['agents'], ['claude', 'cursor', 'copilot', 'agents']]
const PACK_SETS = [['core'], ['core', 'templates'], ['core', 'playwright-cli'], ['core', 'templates', 'playwright-cli']]
const FIXTURE_PATHS = ['', '../fixtures/test-fixture']

test('every platform × pack × version × fixture combination validates and is idempotent', () => {
  for (const platforms of PLATFORM_SETS) {
    for (const packs of PACK_SETS) {
      for (const meetsMinPlaywrightVersion of [true, false]) {
        for (const fixtureImportPath of FIXTURE_PATHS) {
          const cwd = mkdtempSync(join(tmpdir(), 'wico-validate-'))
          const label = `${platforms.join('+')} / ${packs.join('+')} / pw159=${meetsMinPlaywrightVersion} / fixture=${fixtureImportPath || 'none'}`
          try {
            const options = {
              platforms,
              packs,
              cwd,
              meetsMinPlaywrightVersion,
              projectInfo: {
                projectName: 'validated-suite',
                baseUrl: 'https://staging.example.com',
                fixtureImportPath,
                pageObjectsDir: 'src/pages',
                testDir: 'src/tests',
              },
            }
            writePlannedFiles(plan(options))
            const issues = validateOutputTree(cwd)
            assert.deepEqual(issues, [], `${label}:\n${issues.map(i => `  ${i.file}: ${i.message}`).join('\n')}`)

            const again = plan(options)
            assert.ok(again.every(f => f.status === 'unchanged'), `${label}: re-run is not idempotent`)
          } finally {
            rmSync(cwd, { recursive: true, force: true })
          }
        }
      }
    }
  }
})

test('the validator catches the mistakes it exists for', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'wico-validate-neg-'))
  const write = (rel: string, content: string) => {
    const full = join(cwd, rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  try {
    write('.claude/skills/wrong-name/SKILL.md', '---\nname: Playwright_E2E\ndescription: x\n---\n\n# x\n\nSee `references/missing.md` and [link](../nope.md).\n\n{{#if HAS_X}}\n')
    write('.claude/skills/no-frontmatter/SKILL.md', '# no frontmatter\n\nplaywright-cli snapshot --selector "#x"\nconst s = await browser.bind()\n')
    write('.claude/skills/stray-keys/SKILL.md', '---\nname: stray-keys\ndescription: d\nversion: 3\ntools: Bash\n---\n\n# x\n')
    write('.claude/skills/folded/SKILL.md', '---\nname: folded\ndescription: >\n  Wraps onto a second line: and a colon here corrupts it.\n---\n\n# x\n')
    write('.cursor/rules/bad.mdc', '---\ndescription: d\nglobs: "**/*.ts"\n---\n# rule\n')
    write('.github/instructions/bad.instructions.md', '# no applyTo\n')

    const messages = validateOutputTree(cwd).map(issue => `${issue.file}: ${issue.message}`)
    const expect = (needle: string) => assert.ok(messages.some(m => m.includes(needle)), `expected an issue containing "${needle}", got:\n${messages.join('\n')}`)
    expect('must be lowercase')
    expect('must equal the directory name')
    expect('broken reference: references/missing.md')
    expect('broken reference: ../nope.md')
    expect('unrendered template syntax: {{#if HAS_X}}')
    expect('has no YAML frontmatter')
    expect('--selector')
    expect('browser.bind()')
    expect('missing `alwaysApply`')
    expect('must not be quoted')
    expect('applyTo')
    expect('frontmatter key `version` is not part of the Agent Skills spec')
    expect('frontmatter key `tools` is not part of the Agent Skills spec')
    expect('frontmatter `description` uses a YAML block scalar')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('findRelativeReferences ignores URLs and globs', () => {
  const refs = findRelativeReferences('see `references/a.md`, `../b.md`, `c.md`, `.agents/skills/x/SKILL.md`, [d](docs/d.md#top), `https://x.example/e.md`, `**/*.md`, `{{X}}.md`')
  assert.deepEqual(refs.sort(), ['../b.md', '.agents/skills/x/SKILL.md', 'c.md', 'docs/d.md', 'references/a.md'].sort())
})
