import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, existsSync, readdirSync, writeFileSync, symlinkSync, linkSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { plan, writePlannedFiles } from '../src/generator.js'
import { detectLegacyOutputs, removeLegacyOutputs } from '../src/migrate.js'
import { assertInsideProject, UnsafePathError } from '../src/containment.js'

const projectInfo = {
  projectName: 'contained',
  baseUrl: 'https://staging.example.com',
  fixtureImportPath: '',
  pageObjectsDir: 'src/pages',
  testDir: 'src/tests',
}

function options(cwd: string, platforms: string[], packs: string[]) {
  return { platforms, packs, projectInfo, cwd, meetsMinPlaywrightVersion: true, generatorVersion: '2.4.1-test' }
}

/** A project directory and, beside it, a directory standing in for the user's home. */
function sandbox(): { cwd: string; outside: string; cleanup: () => void } {
  const base = mkdtempSync(join(tmpdir(), 'wico-contain-'))
  const cwd = join(base, 'repo')
  const outside = join(base, 'home')
  mkdirSync(cwd)
  mkdirSync(outside)
  return { cwd, outside, cleanup: () => rmSync(base, { recursive: true, force: true }) }
}

test('a skill directory symlinked out of the project is refused at plan time', () => {
  const { cwd, outside, cleanup } = sandbox()
  try {
    mkdirSync(join(cwd, '.claude', 'skills'), { recursive: true })
    symlinkSync(outside, join(cwd, '.claude', 'skills', 'playwright-e2e'))
    assert.throws(() => plan(options(cwd, ['claude'], ['core'])), UnsafePathError)
    assert.deepEqual(readdirSync(outside), [], 'nothing may be written through the link')
  } finally {
    cleanup()
  }
})

test('a dangling symlink in place of a generated file is refused, not planned as new', () => {
  const { cwd, outside, cleanup } = sandbox()
  try {
    const refs = join(cwd, '.agents', 'skills', 'playwright-e2e', 'references')
    mkdirSync(refs, { recursive: true })
    symlinkSync(join(outside, '.zshenv'), join(refs, 'conventions.md'))
    assert.throws(() => plan(options(cwd, ['agents'], ['core'])), /symlink to a path that does not exist/)
    assert.ok(!existsSync(join(outside, '.zshenv')))
  } finally {
    cleanup()
  }
})

test('a symlink that stays inside the project is allowed', () => {
  const { cwd, cleanup } = sandbox()
  try {
    mkdirSync(join(cwd, 'shared-skills'))
    mkdirSync(join(cwd, '.claude'))
    symlinkSync(join(cwd, 'shared-skills'), join(cwd, '.claude', 'skills'))
    const planned = plan(options(cwd, ['claude'], ['core']))
    writePlannedFiles(planned, cwd)
    assert.ok(existsSync(join(cwd, 'shared-skills', 'playwright-e2e', 'SKILL.md')))
    const again = plan(options(cwd, ['claude'], ['core']))
    assert.ok(again.every(file => file.status === 'unchanged'), 'a second plan through the link must see its own output')
  } finally {
    cleanup()
  }
})

test('a hard-linked target is refused', () => {
  const { cwd, outside, cleanup } = sandbox()
  try {
    const victim = join(outside, 'notes.md')
    writeFileSync(victim, 'keep me\n')
    const skill = join(cwd, '.claude', 'skills', 'playwright-e2e')
    mkdirSync(skill, { recursive: true })
    linkSync(victim, join(skill, 'SKILL.md'))
    assert.throws(() => plan(options(cwd, ['claude'], ['core'])), /hard-linked/)
    assert.equal(readFileSync(victim, 'utf-8'), 'keep me\n')
  } finally {
    cleanup()
  }
})

/** Windows has no mkfifo; the pipe tests are about a POSIX special file. */
const noFifo = process.platform === 'win32'

test('a named pipe in place of a generated file is refused before it is opened', { skip: noFifo, timeout: 5000 }, () => {
  const { cwd, cleanup } = sandbox()
  try {
    // A read on a pipe with no writer never returns; the plan must refuse, not open it.
    const skill = join(cwd, '.claude', 'skills', 'playwright-e2e')
    mkdirSync(skill, { recursive: true })
    execFileSync('mkfifo', [join(skill, 'SKILL.md')])
    assert.throws(() => plan(options(cwd, ['claude'], ['core'])), /not a regular file/)

    mkdirSync(join(cwd, '.github'))
    execFileSync('mkfifo', [join(cwd, '.github', 'copilot-instructions.md')])
    assert.throws(() => plan(options(cwd, ['copilot'], ['core'])), /not a regular file/)
  } finally {
    cleanup()
  }
})

test('legacy detection skips a named pipe where it expects a file', { skip: noFifo, timeout: 5000 }, () => {
  const { cwd, cleanup } = sandbox()
  try {
    mkdirSync(join(cwd, '.agent-skills'))
    execFileSync('mkfifo', [join(cwd, '.agent-skills', 'SKILL.md')])
    assert.deepEqual(detectLegacyOutputs(cwd), [])
  } finally {
    cleanup()
  }
})

test('paths outside the project are refused outright', () => {
  const { cwd, outside, cleanup } = sandbox()
  try {
    assert.throws(() => assertInsideProject(cwd, join(outside, 'x.md')), UnsafePathError)
    assert.throws(() => assertInsideProject(cwd, cwd), UnsafePathError)
    assert.doesNotThrow(() => assertInsideProject(cwd, join(cwd, 'a', 'b.md')))
  } finally {
    cleanup()
  }
})

test('legacy cleanup never offers, or removes, files reached through an outward symlink', () => {
  const { cwd, outside, cleanup } = sandbox()
  try {
    writeFileSync(join(outside, 'SKILL.md'), '# Playwright E2E Skills\n\n## Decision Tree\n')
    writeFileSync(join(outside, 'precious.txt'), 'keep me\n')
    symlinkSync(outside, join(cwd, '.agent-skills'))
    const items = detectLegacyOutputs(cwd)
    assert.deepEqual(items, [])
    assert.throws(() => removeLegacyOutputs([{ path: join(cwd, '.agent-skills', 'precious.txt'), kind: 'file', reason: 'x' }], cwd), UnsafePathError)
    assert.ok(existsSync(join(outside, 'precious.txt')))
  } finally {
    cleanup()
  }
})
