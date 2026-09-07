import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFrontmatter, serializeFrontmatter, withFrontmatter } from '../src/frontmatter.js'

test('parses flat and nested frontmatter', () => {
  const text = `---
name: playwright-e2e
description: "Plan, write: review. Use when editing *.spec.ts"
allowed-tools: Bash(playwright-cli:*) Read
metadata:
  generator: wico
  version: "2.0.0"
---

# Body
`
  const parsed = parseFrontmatter(text)
  assert.equal(parsed.hasFrontmatter, true)
  assert.equal(parsed.data.name, 'playwright-e2e')
  assert.equal(parsed.data.description, 'Plan, write: review. Use when editing *.spec.ts')
  assert.equal(parsed.data['allowed-tools'], 'Bash(playwright-cli:*) Read')
  assert.deepEqual(parsed.data.metadata, { generator: 'wico', version: '2.0.0' })
  assert.equal(parsed.body, '\n# Body\n')
})

test('text without frontmatter is returned untouched', () => {
  const parsed = parseFrontmatter('# Just a heading\n')
  assert.equal(parsed.hasFrontmatter, false)
  assert.deepEqual(parsed.data, {})
  assert.equal(parsed.body, '# Just a heading\n')
})

test('serialize quotes values that are not plain YAML scalars', () => {
  const out = serializeFrontmatter({ name: 'x', description: 'Use when: needed', globs: '**/*.spec.ts,**/*.page.ts' })
  assert.equal(out, '---\nname: x\ndescription: "Use when: needed"\nglobs: "**/*.spec.ts,**/*.page.ts"\n---\n')
})

test('round-trips through parse and serialize', () => {
  const data = { name: 'a-b', description: 'Has "quotes" and: colons', metadata: { k: 'v 1' } }
  const parsed = parseFrontmatter(serializeFrontmatter(data) + '\nbody')
  assert.deepEqual(parsed.data, data)
  assert.equal(parsed.body, '\nbody')
})

test('withFrontmatter prepends to a plain body', () => {
  const out = withFrontmatter('# Hello\n', { name: 'hello', description: 'Say hi' })
  assert.equal(out, '---\nname: hello\ndescription: Say hi\n---\n\n# Hello\n')
})

test('withFrontmatter merges into existing frontmatter, data wins, nested maps merge', () => {
  const existing = '---\nname: keep\ndescription: old\nmetadata:\n  a: "1"\n---\n\n# Body\n'
  const out = withFrontmatter(existing, { description: 'new', metadata: { b: '2' } })
  const parsed = parseFrontmatter(out)
  assert.equal(parsed.data.name, 'keep')
  assert.equal(parsed.data.description, 'new')
  assert.deepEqual(parsed.data.metadata, { a: '1', b: '2' })
  assert.equal(parsed.body, '\n# Body\n')
  assert.equal(out.split('---').length - 1, 2, 'exactly one frontmatter block')
})
