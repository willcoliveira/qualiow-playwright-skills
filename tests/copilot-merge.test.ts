import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeCopilotContent } from '../src/platforms/copilot.js'

const START = '<!-- wico-playwright-agent-skills:start -->'
const END = '<!-- wico-playwright-agent-skills:end -->'

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

test('wraps content in markers when file does not exist', () => {
  const out = mergeCopilotContent(null, 'generated body')
  assert.ok(out.startsWith(START))
  assert.ok(out.trimEnd().endsWith(END))
  assert.ok(out.includes('generated body'))
})

test('preserves hand-written content when appending to unmarked file', () => {
  const out = mergeCopilotContent('# My own rules\n\nDo not touch.', 'generated body')
  assert.ok(out.startsWith('# My own rules'))
  assert.ok(out.includes('generated body'))
  assert.equal(countOccurrences(out, START), 1)
})

test('re-running replaces the generated block instead of duplicating', () => {
  const first = mergeCopilotContent('# My own rules', 'generated v1')
  const second = mergeCopilotContent(first, 'generated v2')
  assert.ok(second.includes('generated v2'))
  assert.ok(!second.includes('generated v1'))
  assert.ok(second.startsWith('# My own rules'))
  assert.equal(countOccurrences(second, START), 1)
  assert.equal(countOccurrences(second, END), 1)
})

test('preserves content before and after the marker block', () => {
  const existing = `intro text\n\n${START}\n\nold\n\n${END}\n\noutro text`
  const out = mergeCopilotContent(existing, 'new content')
  assert.ok(out.startsWith('intro text'))
  assert.ok(out.trimEnd().endsWith('outro text'))
  assert.ok(out.includes('new content'))
  assert.ok(!out.includes('old\n'))
})
