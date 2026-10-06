import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractFences, moduleFor, checkFences } from '../scripts/check-ts-fences.js'

const REPO_ROOT = join(import.meta.dirname, '..')

test('extractFences takes ts and typescript fences only, with source lines and de-indented code', () => {
  const text = [
    '# x',             // 1
    '```bash',         // 2
    'npx playwright test',
    '```',
    '```ts',           // 5
    'const a = 1',
    '```',
    '- item',
    '  ```typescript', // 9
    '  const b = 2',
    '    const c = 3',
    '  ```',
    '````md',          // 13
    '```ts',
    'not a fence of its own',
    '```',
    '````',
  ].join('\n')
  const fences = extractFences(text)
  assert.deepEqual(fences.map(f => f.line), [5, 9])
  assert.equal(fences[0].code, 'const a = 1')
  assert.equal(fences[1].code, 'const b = 2\n  const c = 3')
  assert.ok(fences.every(f => f.directive === 'check' && f.declared.length === 0))
})

test('directives stack directly above a fence and are validated', () => {
  const fences = extractFences([
    '<!-- ts-check: wrap-class -->',
    '<!-- ts-check: declare Input, Thing -->',
    '<!-- ts-check: declare Event -->',
    '```ts',
    'x = 1',
    '```',
    '',
    '<!-- ts-check: skip shown wrong on purpose -->',
    '```typescript',
    'nope',
    '```',
  ].join('\n'))
  assert.equal(fences[0].directive, 'wrap-class')
  assert.deepEqual(fences[0].declared.sort(), ['Event', 'Input', 'Thing'])
  assert.equal(fences[1].directive, 'skip')

  const throwsOn = (text: string, pattern: RegExp) => assert.throws(() => extractFences(text, 'f.md'), pattern)
  throwsOn('<!-- ts-check: skp -->\n```ts\nx\n```', /unknown ts-check directive "skp"/)
  throwsOn('<!-- ts-check: skip -->\n<!-- ts-check: wrap-test -->\n```ts\nx\n```', /not two/)
  throwsOn('<!-- ts-check: declare a-b -->\n```ts\nx\n```', /identifiers \(got "a-b"\)/)
  throwsOn('<!-- ts-check: skip -->\n\n```ts\nx\n```', /f\.md:1: ts-check directive is not directly above/)
  throwsOn('<!-- ts-check: skip -->\n```bash\nx\n```', /not directly above a TypeScript fence/)
})

test('moduleFor reports how many lines precede the fence, so diagnostics map back', () => {
  const plain = moduleFor({ code: 'await page.goto("/")', directive: 'check', declared: [] })
  assert.equal(plain.offset, 0)
  assert.match(plain.source, /export \{\}/, 'a fence without imports is made a module')

  const imported = moduleFor({ code: "import { test } from '@playwright/test'", directive: 'check', declared: [] })
  assert.doesNotMatch(imported.source, /export \{\}/)

  const declared = moduleFor({ code: 'x', directive: 'check', declared: ['a', 'B'] })
  assert.equal(declared.offset, 2)
  assert.equal(declared.source.split('\n')[declared.offset], 'x')

  for (const directive of ['wrap-test', 'wrap-class', 'wrap-config'] as const) {
    const wrapped = moduleFor({ code: 'first', directive, declared: ['a'] })
    assert.equal(wrapped.source.split('\n')[wrapped.offset].trim(), 'first', directive)
  }
})

test('checkFences fails a fence that misuses the Playwright API and passes one that does not', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wico-fences-'))
  try {
    mkdirSync(join(dir, 'core'))
    writeFileSync(join(dir, 'core', 'sample.md'), [
      '# sample',                                                   // 1
      '',
      '```ts',                                                      // 3
      "await page.getByRole('button', { name: 'Pay' }).click()",
      "await expect(page.getByText('Paid')).toBeVisible()",
      '```',
      '',
      '```ts',                                                      // 8
      "await expect(page.getByText('Paid')).toBeVisibel()",         // 9
      '```',
      '',
      '<!-- ts-check: wrap-config -->',
      '```ts',                                                      // 13
      'retries: 0,',
      'failOnFlakyTests: !!process.env.CI,',
      '```',
      '',
      '<!-- ts-check: declare checkoutPage -->',
      '```ts',                                                      // 19
      "import { thing } from '../helpers/not-in-this-repo'",
      'await checkoutPage.submit(thing)',
      '```',
      '',
      '<!-- ts-check: skip -->',
      '```ts',
      'this is not code',
      '```',
      '',
      '{{#if HAS_CUSTOM_FIXTURE}}',
      '```ts',                                                      // 30
      "import { test } from '{{FIXTURE_IMPORT_PATH}}'",
      "test('x', async ({ page }) => { await page.goto('/') })",
      '```',
      '{{/if}}',
    ].join('\n'))

    const result = checkFences({ repoRoot: REPO_ROOT, skillsDir: dir })
    assert.equal(result.toolError, null, result.toolError ?? '')
    assert.equal(result.skipped.length, 1)
    assert.deepEqual(
      result.failures.map(f => [f.fenceLine, f.line, f.code]),
      [[8, 9, 'TS2551']],
      result.failures.map(f => `${f.file}:${f.line} ${f.code} ${f.message}`).join('\n'),
    )
    assert.ok(result.unresolved.includes('../helpers/not-in-this-repo'))
    assert.ok(!result.unresolved.includes("''"), 'a fence inside a false conditional is not checked under that variant')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
