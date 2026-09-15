import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { plan, writePlannedFiles } from '../src/generator.js'
import { validateOutputTree, findRelativeReferences, findOwnedAssetReferences, extractBashBlocks, allowedToolPrefixes, checkBashLine, stripForbiddenSection } from '../src/validate.js'

const PLATFORM_SETS = [['claude'], ['cursor'], ['copilot'], ['agents'], ['claude', 'cursor', 'copilot', 'agents']]
const PACK_SETS = [['core'], ['core', 'templates'], ['core', 'playwright-cli'], ['core', 'templates', 'playwright-cli'], ['core', 'workflows'], ['core', 'templates', 'workflows', 'playwright-cli']]
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
    write('.claude/skills/ghost-script/SKILL.md', [
      '---', 'name: ghost-script', 'description: d', '---', '',
      '# x', '',
      'Run it N times with `scripts/run-5x.mjs`, then read `src/pages/basket.page.ts`',
      'and `test-results/results.json`.', '',
      '```bash', 'node scripts/missing-runner.mjs 5', 'npx playwright test', '```', '',
    ].join('\n'))
    write('.claude/skills/env-prefix/SKILL.md', [
      '---', 'name: env-prefix', 'description: d',
      'allowed-tools: "Bash(npx playwright:*)"', '---', '',
      '```bash', 'PLAYWRIGHT_HTML_OPEN=never npx playwright test', '```', '',
    ].join('\n'))
    write('.claude/skills/unused-grant/SKILL.md', [
      '---', 'name: unused-grant', 'description: d',
      'allowed-tools: "Bash(npx playwright:*), Bash(playwright-cli:*)"', '---', '',
      '```bash', 'npx playwright test', '```', '',
    ].join('\n'))
    write('.claude/commands/bad-cmd.md', ['---', 'description: d', 'tools: Read', '---', '', 'no pointer here', ''].join('\n'))
    write('.claude/agents/mismatched.md', [
      '---', 'name: other-name', 'description: d', 'tools: Read', 'model: gpt', '---', '',
      '# x', '', 'Grade each finding and recommend a fix.', '',
    ].join('\n'))
    write('.cursor/commands/bad.md', '# no frontmatter\n')
    write('.github/prompts/bad.prompt.md', ['---', 'description: d', '---', '', '# x', ''].join('\n'))
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
    expect('broken reference: scripts/run-5x.mjs')
    expect('broken reference: scripts/missing-runner.mjs')
    expect('`node` is neither a shell builtin nor covered by `allowed-tools`')
    expect('permission rules match the first literal token')
    expect('grants `Bash(playwright-cli:*)` but no command in the skill uses it')
    expect('command frontmatter key `tools` is not supported')
    expect('command file does not point at a workflow body')
    expect('agent `name` must equal the filename "mismatched"')
    expect('agent `model` must be one of')
    expect('agent body has no `## Forbidden` section')
    expect('judgement verb `grade`')
    expect('judgement verb `recommend`')
    expect('Cursor command needs a `description`')
    expect('prompt file needs `mode: agent`')
    assert.ok(
      !messages.some(m => m.includes('basket.page.ts') || m.includes('test-results/results.json')),
      `paths belonging to the reader's project must not be resolved against our tree:\n${messages.join('\n')}`,
    )
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('findRelativeReferences ignores URLs and globs', () => {
  const refs = findRelativeReferences('see `references/a.md`, `../b.md`, `c.md`, `.agents/skills/x/SKILL.md`, [d](docs/d.md#top), `https://x.example/e.md`, `**/*.md`, `{{X}}.md`')
  assert.deepEqual(refs.sort(), ['../b.md', '.agents/skills/x/SKILL.md', 'c.md', 'docs/d.md', 'references/a.md'].sort())
})

test('findOwnedAssetReferences takes only paths this generator owns', () => {
  const refs = findOwnedAssetReferences([
    'Run `scripts/pass-rate.mjs`, not `src/pages/basket.page.ts` or `playwright.config.ts`.',
    'Nor `test-results/results.json`, nor [a link](assets/seed.json), nor `https://x.example/a.js`.',
    '',
    '```bash',
    '# a comment is not a command',
    'node scripts/runner.mjs 5',
    'npx playwright test',
    'cp test-results/results.json "runs/run-$i.json"',
    '```',
  ].join('\n'))
  assert.deepEqual(refs.sort(), ['assets/seed.json', 'scripts/pass-rate.mjs', 'scripts/runner.mjs'].sort())
})

test('extractBashBlocks drops comments and blank lines', () => {
  const blocks = extractBashBlocks('```bash\n# note\n\nnpx playwright test\n```\n\ntext\n\n```ts\nconst a = 1\n```\n')
  assert.deepEqual(blocks, [['npx playwright test']])
})

test('allowedToolPrefixes reads the Bash grants and ignores the rest', () => {
  assert.deepEqual(
    allowedToolPrefixes('Bash(playwright-cli:*), Bash(npx playwright:*), Read, Write, Glob'),
    ['npx playwright', 'playwright-cli'],
  )
})

test('checkBashLine matches on the first literal token, longest grant first', () => {
  const prefixes = allowedToolPrefixes('Bash(npx playwright:*), Bash(npx:*)')
  assert.equal(checkBashLine('npx playwright test --repeat-each 3', prefixes).prefix, 'npx playwright')
  assert.equal(checkBashLine('npx tsc --noEmit', prefixes).prefix, 'npx')
  assert.equal(checkBashLine('export FOO=1', prefixes).builtin, true)

  const env = checkBashLine('FOO=1 npx playwright test', prefixes)
  assert.equal(env.envAssignment, true)
  assert.equal(env.prefix, null, 'an assignment shifts npx out of first position, so no grant applies')

  assert.equal(checkBashLine('node runner.mjs', prefixes).prefix, null)
})

test('stripForbiddenSection removes only the Forbidden section, including the last one', () => {
  const body = '# T\n\nintro\n\n## Rules\n\nkeep me\n\n## Forbidden\n\ndrop me\n'
  const stripped = stripForbiddenSection(body)
  assert.ok(stripped.includes('keep me'))
  assert.ok(!stripped.includes('drop me'), 'a trailing Forbidden section must still be removed')
})
