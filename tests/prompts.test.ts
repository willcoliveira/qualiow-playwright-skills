import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions } from '../src/prompts.js'

test('compares plain versions', () => {
  assert.ok(compareVersions('1.59.0', '1.59.0') === 0)
  assert.ok(compareVersions('1.60.1', '1.59.0') > 0)
  assert.ok(compareVersions('1.58.9', '1.59.0') < 0)
  assert.ok(compareVersions('2.0.0', '1.99.99') > 0)
})

test('handles pre-release suffixes without NaN poisoning', () => {
  assert.ok(compareVersions('1.60.0-beta.1', '1.59.0') > 0)
  assert.ok(compareVersions('1.58.0-alpha', '1.59.0') < 0)
})

test('handles short versions', () => {
  assert.ok(compareVersions('1.59', '1.59.0') === 0)
  assert.ok(compareVersions('2', '1.59.0') > 0)
})
