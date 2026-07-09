import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderTemplate, buildContext } from '../src/template-engine.js'

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

test('keeps unknown placeholders intact', () => {
  const ctx = buildContext(baseInfo)
  const out = renderTemplate('Keep {{UNKNOWN_KEY}} as-is', ctx)
  assert.equal(out, 'Keep {{UNKNOWN_KEY}} as-is')
})

test('renders truthy conditional blocks and drops falsy ones', () => {
  const ctx = buildContext(baseInfo)
  const template = '{{#if HAS_CUSTOM_FIXTURE}}custom{{/if}}{{#if NO_CUSTOM_FIXTURE}}default{{/if}}'
  assert.equal(renderTemplate(template, ctx), 'custom')
})

test('fixtureImportPath of "none" means no custom fixture', () => {
  const ctx = buildContext({ ...baseInfo, fixtureImportPath: 'none' })
  assert.equal(ctx.HAS_CUSTOM_FIXTURE, false)
  assert.equal(ctx.NO_CUSTOM_FIXTURE, true)
})

test('empty fixtureImportPath means no custom fixture', () => {
  const ctx = buildContext({ ...baseInfo, fixtureImportPath: '' })
  assert.equal(ctx.HAS_CUSTOM_FIXTURE, false)
})

test('playwright 1.59 conditionals follow meetsMinPlaywrightVersion', () => {
  const modern = buildContext(baseInfo, { meetsMinPlaywrightVersion: true })
  const classic = buildContext(baseInfo, { meetsMinPlaywrightVersion: false })
  const template = '{{#if HAS_PLAYWRIGHT_159}}agent{{/if}}{{#if NO_PLAYWRIGHT_159}}classic{{/if}}'
  assert.equal(renderTemplate(template, modern), 'agent')
  assert.equal(renderTemplate(template, classic), 'classic')
})

test('collapses runs of 3+ newlines left by removed blocks', () => {
  const ctx = buildContext(baseInfo)
  const out = renderTemplate('a\n{{#if HAS_PAGE_FACTORY}}\nnever\n{{/if}}\n\n\nb', ctx)
  assert.ok(!out.includes('\n\n\n'))
})
