import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFlags, isInteractive, validateBaseUrl, CliUsageError, type Environment } from '../src/cli.js'

const tty: Environment = { isCI: false, stdinIsTTY: true, stdoutIsTTY: true }

test('no arguments means interactive init', () => {
  const flags = parseFlags([])
  assert.equal(flags.command, 'init')
  assert.equal(flags.platforms, undefined)
  assert.equal(flags.packs, undefined)
  assert.equal(flags.yes, false)
  assert.equal(isInteractive(flags, tty), true)
})

test('parses selection flags, trims and dedupes lists, resolves the generic alias', () => {
  const flags = parseFlags([
    'init',
    '--platforms', ' claude, generic ,cursor,claude',
    '--packs', 'templates',
    '--project-name', 'shop',
    '--base-url', 'https://staging.shop.example',
    '--fixture-import-path', 'none',
    '--page-objects-dir', 'e2e/pages',
    '--test-dir', 'e2e/specs',
  ])
  assert.deepEqual(flags.platforms, ['claude', 'agents', 'cursor'])
  assert.deepEqual(flags.packs, ['templates'])
  assert.equal(flags.projectName, 'shop')
  assert.equal(flags.baseUrl, 'https://staging.shop.example')
  assert.equal(flags.fixtureImportPath, 'none')
  assert.equal(flags.pageObjectsDir, 'e2e/pages')
  assert.equal(flags.testDir, 'e2e/specs')
})

test('boolean flags and their short forms', () => {
  const flags = parseFlags(['-y', '-f', '--dry-run', '--clean-legacy', '--install-playwright-skills'])
  assert.equal(flags.yes, true)
  assert.equal(flags.nonInteractive, true, '--yes implies --non-interactive')
  assert.equal(flags.force, true)
  assert.equal(flags.dryRun, true)
  assert.equal(flags.cleanLegacy, true)
  assert.equal(flags.installPlaywrightSkills, true)
  assert.equal(parseFlags(['-h']).help, true)
  assert.equal(parseFlags(['-v']).version, true)
  assert.equal(parseFlags(['help']).command, 'help')
})

test('interactivity is off with --yes, --non-interactive, CI, or a missing TTY', () => {
  assert.equal(isInteractive(parseFlags(['--yes']), tty), false)
  assert.equal(isInteractive(parseFlags(['--non-interactive']), tty), false)
  assert.equal(isInteractive(parseFlags([]), { ...tty, isCI: true }), false)
  assert.equal(isInteractive(parseFlags([]), { ...tty, stdinIsTTY: false }), false)
  assert.equal(isInteractive(parseFlags([]), { ...tty, stdoutIsTTY: false }), false)
})

test('rejects unknown flags, values, commands and bad URLs with a usage error', () => {
  assert.throws(() => parseFlags(['--bogus']), CliUsageError)
  assert.throws(() => parseFlags(['--platforms', 'vscode']), /unknown value "vscode"/)
  assert.throws(() => parseFlags(['--packs', 'core,everything']), /unknown value "everything"/)
  assert.throws(() => parseFlags(['--platforms', ' , ']), /comma-separated list/)
  assert.throws(() => parseFlags(['--base-url', 'ftp://x']), /http/)
  assert.throws(() => parseFlags(['--base-url', 'not a url']), /valid URL/)
  assert.throws(() => parseFlags(['init', 'extra']), /Unexpected arguments/)
})

test('validateBaseUrl accepts http(s) and blank, rejects the rest', () => {
  assert.equal(validateBaseUrl('https://a.example'), undefined)
  assert.equal(validateBaseUrl('http://localhost:3000'), undefined)
  assert.equal(validateBaseUrl(''), undefined)
  assert.ok(validateBaseUrl('file:///tmp'))
  assert.ok(validateBaseUrl('nope'))
})
