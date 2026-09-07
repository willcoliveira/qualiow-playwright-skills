import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderTemplate, buildContext, findUnrenderedTemplate } from '../src/template-engine.js'

const baseInfo = {
  projectName: 'my-suite',
  baseUrl: 'https://staging.example.com',
  fixtureImportPath: '../fixtures/test-fixture',
  pageObjectsDir: 'src/pages',
  testDir: 'src/tests',
}

test('replaces string placeholders', () => {
  const ctx = buildContext(baseInfo)
  const out = renderTemplate('Project: {{PROJECT_NAME}} at {{BASE_URL}}', ctx)
  assert.equal(out, 'Project: my-suite at https://staging.example.com')
})

test('keeps unknown placeholders intact and never renders booleans', () => {
  const ctx = buildContext(baseInfo)
  assert.equal(renderTemplate('Keep {{UNKNOWN_KEY}} as-is', ctx), 'Keep {{UNKNOWN_KEY}} as-is')
  assert.equal(renderTemplate('Flag {{HAS_CUSTOM_FIXTURE}}', ctx), 'Flag {{HAS_CUSTOM_FIXTURE}}')
})

test('renders truthy conditional blocks and drops falsy ones', () => {
  const ctx = buildContext(baseInfo)
  assert.equal(renderTemplate('{{#if HAS_CUSTOM_FIXTURE}}custom{{/if}}', ctx), 'custom')
  assert.equal(renderTemplate('{{#if HAS_PLAYWRIGHT_159}}agent{{/if}}', ctx), '')
})

test('supports {{else}} inline and block-level', () => {
  const ctx = buildContext(baseInfo)
  assert.equal(renderTemplate('a{{#if HAS_PLAYWRIGHT_159}}yes{{else}}no{{/if}}b', ctx), 'anob')
  const block = 'before\n{{#if HAS_CUSTOM_FIXTURE}}\nfixture\n{{else}}\ndefault\n{{/if}}\nafter\n'
  assert.equal(renderTemplate(block, ctx), 'before\nfixture\nafter\n')
  assert.equal(renderTemplate(block, buildContext({ ...baseInfo, fixtureImportPath: '' })), 'before\ndefault\nafter\n')
})

test('block-level tags remove their own lines without leaving blanks', () => {
  const ctx = buildContext(baseInfo, { meetsMinPlaywrightVersion: false })
  const template = '# Title\n\n{{#if HAS_PLAYWRIGHT_159}}\n## Agent section\n\ntext\n{{/if}}\n\n## Next\n'
  assert.equal(renderTemplate(template, ctx), '# Title\n\n## Next\n')
  const kept = renderTemplate(template, buildContext(baseInfo, { meetsMinPlaywrightVersion: true }))
  assert.equal(kept, '# Title\n\n## Agent section\n\ntext\n\n## Next\n')
})

test('a conditional table row disappears without breaking the table', () => {
  const ctx = buildContext(baseInfo, { packs: ['core'] })
  const table = '| a | b |\n|---|---|\n| 1 | 2 |\n{{#if HAS_TEMPLATES}}| 3 | 4 |{{/if}}\n| 5 | 6 |\n'
  assert.equal(renderTemplate(table, ctx), '| a | b |\n|---|---|\n| 1 | 2 |\n| 5 | 6 |\n')
})

test('inline conditionals keep surrounding text and newlines', () => {
  const on = buildContext(baseInfo, { meetsMinPlaywrightVersion: true })
  const off = buildContext(baseInfo, { meetsMinPlaywrightVersion: false })
  const template = '# Tracing{{#if HAS_PLAYWRIGHT_159}} & CLI{{/if}}\n\nBody\n'
  assert.equal(renderTemplate(template, on), '# Tracing & CLI\n\nBody\n')
  assert.equal(renderTemplate(template, off), '# Tracing\n\nBody\n')
})

test('nested conditionals resolve innermost first', () => {
  const template = '{{#if HAS_CORE}}core{{#if HAS_TEMPLATES}}+templates{{else}}-only{{/if}}{{/if}}'
  assert.equal(renderTemplate(template, buildContext(baseInfo, { packs: ['core', 'templates'] })), 'core+templates')
  assert.equal(renderTemplate(template, buildContext(baseInfo, { packs: ['core'] })), 'core-only')
  assert.equal(renderTemplate(template, buildContext(baseInfo, { packs: [] })), '')
})

test('unknown condition keys throw instead of silently dropping content', () => {
  const ctx = buildContext(baseInfo)
  assert.throws(() => renderTemplate('{{#if HAS_TYPO}}x{{/if}}', ctx), /Unknown template condition/)
})

test('collapses runs of blank lines outside fenced code but not inside', () => {
  const ctx = buildContext(baseInfo)
  const out = renderTemplate('a\n\n\n\nb\n\n```ts\nline1\n\n\n\nline2\n```\n\n\n\nc', ctx)
  assert.equal(out, 'a\n\nb\n\n```ts\nline1\n\n\n\nline2\n```\n\nc')
})

test('fixtureImportPath "none" (any case, padded) or empty means no custom fixture', () => {
  for (const value of ['none', 'None', ' NONE ', '']) {
    const ctx = buildContext({ ...baseInfo, fixtureImportPath: value })
    assert.equal(ctx.HAS_CUSTOM_FIXTURE, false, `value: ${JSON.stringify(value)}`)
    assert.equal(ctx.FIXTURE_IMPORT_PATH, '')
  }
  assert.equal(buildContext({ ...baseInfo, fixtureImportPath: ' ../fixtures/test ' }).FIXTURE_IMPORT_PATH, '../fixtures/test')
})

test('playwright 1.59 and pack flags follow the options', () => {
  const modern = buildContext(baseInfo, { meetsMinPlaywrightVersion: true, packs: ['core', 'playwright-cli'] })
  assert.equal(modern.HAS_PLAYWRIGHT_159, true)
  assert.equal(modern.HAS_CORE, true)
  assert.equal(modern.HAS_TEMPLATES, false)
  assert.equal(modern.HAS_PLAYWRIGHT_CLI, true)
  const defaults = buildContext(baseInfo)
  assert.equal(defaults.HAS_PLAYWRIGHT_159, false)
  assert.equal(defaults.HAS_TEMPLATES, true)
})

test('findUnrenderedTemplate flags our syntax but not GitHub Actions expressions', () => {
  assert.equal(findUnrenderedTemplate('run: npx playwright test --shard=${{ matrix.shard }}/4'), null)
  assert.equal(findUnrenderedTemplate('{{#if HAS_X}}'), '{{#if HAS_X}}')
  assert.equal(findUnrenderedTemplate('a {{else}} b'), '{{else}}')
  assert.equal(findUnrenderedTemplate('a {{/if}} b'), '{{/if}}')
  assert.equal(findUnrenderedTemplate('Name: {{PROJECT_NAME}}'), '{{PROJECT_NAME}}')
  assert.equal(findUnrenderedTemplate('nothing here'), null)
})
