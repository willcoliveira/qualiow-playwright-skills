import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildInstallCommands, formatCommand, type SkillsDetection } from '../src/playwright-skills.js'

const bundled: SkillsDetection = {
  playwright: { name: '@playwright/test', version: '1.63.0', source: 'installed' },
  playwrightCli: null,
  meetsMinVersion: true,
  hasBundledCli: true,
}

test('bundled CLI: one install per target plus the optional trace skill', () => {
  const plan = buildInstallCommands(bundled, ['claude', 'cursor', 'copilot'])
  assert.equal(plan.runnable, true)
  assert.deepEqual(plan.commands.map(formatCommand), [
    'npx playwright cli install --skills',
    'npx playwright cli install --skills=agents',
    'npx playwright trace install-skill',
  ])
  assert.equal(plan.commands[2].optional, true)
  assert.ok(plan.commands[0].label.includes('.claude/skills/playwright-cli/'))
  assert.ok(plan.commands[1].label.includes('.agents/skills/playwright-cli/'))
})

test('only the targets for the selected platforms are installed', () => {
  assert.deepEqual(buildInstallCommands(bundled, ['claude']).commands.map(formatCommand), [
    'npx playwright cli install --skills',
    'npx playwright trace install-skill',
  ])
  assert.deepEqual(buildInstallCommands(bundled, ['agents']).commands.map(formatCommand), [
    'npx playwright cli install --skills=agents',
    'npx playwright trace install-skill',
  ])
})

test('standalone @playwright/cli without a bundled CLI uses playwright-cli directly', () => {
  const plan = buildInstallCommands({
    playwright: { name: '@playwright/test', version: '1.60.0', source: 'installed' },
    playwrightCli: { name: '@playwright/cli', version: '0.4.0', source: 'installed' },
    meetsMinVersion: true,
    hasBundledCli: false,
  }, ['claude'])
  assert.equal(plan.runnable, true)
  assert.deepEqual(plan.commands.map(formatCommand), [
    'npx playwright-cli install --skills',
    'npx playwright trace install-skill',
  ])
})

test('the trace skill is skipped when Playwright is too old or absent', () => {
  const plan = buildInstallCommands({
    playwright: null,
    playwrightCli: { name: '@playwright/cli', version: '0.4.0', source: 'installed' },
    meetsMinVersion: false,
    hasBundledCli: false,
  }, ['claude'])
  assert.deepEqual(plan.commands.map(formatCommand), ['npx playwright-cli install --skills'])
})

test('nothing usable installed: print guidance only', () => {
  const plan = buildInstallCommands({
    playwright: { name: '@playwright/test', version: '1.58.0', source: 'range' },
    playwrightCli: null,
    meetsMinVersion: false,
    hasBundledCli: false,
  }, ['claude', 'cursor'])
  assert.equal(plan.runnable, false)
  assert.deepEqual(plan.commands, [])
  assert.ok(plan.notes.some(note => note.includes('npx playwright cli install --skills') && note.includes('--skills=agents')))
  assert.ok(plan.notes.some(note => note.includes('npm i -g @playwright/cli@latest')))

  const none = buildInstallCommands({ playwright: null, playwrightCli: null, meetsMinVersion: false, hasBundledCli: false }, ['claude'])
  assert.equal(none.runnable, false)
  assert.ok(none.notes[0].includes('not detected'))
})

test('a package that is only declared, not installed, is never run through npx', () => {
  // `npx playwright-cli` with nothing installed fetches the deprecated `playwright-cli`
  // package from the registry, not the `@playwright/cli` the project declares.
  const cliDeclared = buildInstallCommands({
    playwright: null,
    playwrightCli: { name: '@playwright/cli', version: '0.4.0', source: 'range' },
    meetsMinVersion: false,
    hasBundledCli: false,
  }, ['claude'])
  assert.equal(cliDeclared.runnable, false)
  assert.deepEqual(cliDeclared.commands, [])
  assert.ok(cliDeclared.notes[0].includes('@playwright/cli is declared in package.json but not installed'))
  assert.ok(cliDeclared.notes[0].includes('`npx playwright-cli install --skills`'))

  // A range new enough for the bundled CLI is still not an installed one.
  const bundledDeclared = buildInstallCommands({ ...bundled, playwright: { name: '@playwright/test', version: '1.63.0', source: 'range' } }, ['claude'])
  assert.equal(bundledDeclared.runnable, false)
  assert.ok(bundledDeclared.notes[0].includes('`npx playwright cli install --skills`'))
})
