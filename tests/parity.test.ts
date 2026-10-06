import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { plan, writePlannedFiles } from '../src/generator.js'
import { loadWorkflows, loadAgents, mergeAllowedTools } from '../src/workflows.js'
import { stripForbiddenSection, allowedToolPrefixes } from '../src/validate.js'
import { parseFrontmatter } from '../src/frontmatter.js'

const SKILLS_DIR = join(import.meta.dirname, '..', 'skills')

const projectInfo = {
  projectName: 'parity-suite',
  baseUrl: 'https://staging.example.com',
  fixtureImportPath: '',
  pageObjectsDir: 'src/pages',
  testDir: 'src/tests',
}

function generate(platforms: string[], packs: string[], meetsMinPlaywrightVersion = true): string {
  const cwd = mkdtempSync(join(tmpdir(), 'wico-parity-'))
  writePlannedFiles(plan({ platforms, packs, projectInfo, cwd, meetsMinPlaywrightVersion, generatorVersion: '2.2.0-test' }))
  return cwd
}

function withProject(platforms: string[], packs: string[], fn: (cwd: string) => void, pw159 = true): void {
  const cwd = generate(platforms, packs, pw159)
  try {
    fn(cwd)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

const CLAUDE = '.claude/skills/playwright-e2e/workflows'
const AGENTS = '.agents/skills/playwright-e2e/workflows'

test('a workflow body is byte-identical in both skill trees, in every combination', () => {
  const workflows = loadWorkflows(SKILLS_DIR)
  assert.ok(workflows.length > 0, 'no workflows to check')

  for (const packs of [['core', 'workflows'], ['core', 'templates', 'workflows']]) {
    for (const pw159 of [true, false]) {
      withProject(['claude', 'cursor', 'copilot', 'agents'], packs, cwd => {
        for (const workflow of workflows) {
          const a = readFileSync(join(cwd, CLAUDE, `${workflow.id}.md`), 'utf-8')
          const b = readFileSync(join(cwd, AGENTS, `${workflow.id}.md`), 'utf-8')
          assert.equal(a, b, `${workflow.id} differs between the two skill trees (${packs.join('+')}, pw159=${pw159})`)
        }
      }, pw159)
    }
  }
})

test('every command file resolves to a workflow body that exists', () => {
  const workflows = loadWorkflows(SKILLS_DIR)
  withProject(['claude', 'cursor', 'copilot', 'agents'], ['core', 'workflows'], cwd => {
    const wrappers = [
      ...workflows.map(w => `.claude/commands/${w.id}.md`),
      ...workflows.map(w => `.cursor/commands/${w.id}.md`),
      ...workflows.map(w => `.github/prompts/${w.id}.prompt.md`),
    ]
    for (const rel of wrappers) {
      const full = join(cwd, rel)
      assert.ok(existsSync(full), `missing wrapper: ${rel}`)
      const text = readFileSync(full, 'utf-8')
      const pointer = /`([^`]*\/workflows\/[^`]+\.md)`/.exec(text)
      assert.ok(pointer, `${rel} names no workflow body`)
      assert.ok(existsSync(join(cwd, pointer[1])), `${rel} points at ${pointer[1]}, which was not generated`)
    }
  })
})

test('a platform with no command construct still lists every procedure by name', () => {
  const workflows = loadWorkflows(SKILLS_DIR)
  withProject(['agents'], ['core', 'workflows'], cwd => {
    const skill = readFileSync(join(cwd, '.agents/skills/playwright-e2e/SKILL.md'), 'utf-8')
    assert.match(skill, /## Procedures/, 'the fallback table is the only way .agents can reach a procedure')
    for (const workflow of workflows) {
      assert.ok(skill.includes(workflow.id), `SKILL.md does not name ${workflow.id}, so this platform cannot reach it`)
    }
    assert.ok(!existsSync(join(cwd, '.cursor')), 'no Cursor output was requested')
    assert.ok(!existsSync(join(cwd, '.claude')), 'no Claude output was requested')
  })
})

test('without the workflows pack, nothing points at a procedure that was not installed', () => {
  withProject(['claude', 'cursor', 'copilot', 'agents'], ['core'], cwd => {
    for (const rel of ['.claude/commands', '.cursor/commands', '.github/prompts', '.claude/agents', `${CLAUDE}`, `${AGENTS}`]) {
      assert.ok(!existsSync(join(cwd, rel)), `${rel} must not exist without the workflows pack`)
    }
    const skill = readFileSync(join(cwd, '.claude/skills/playwright-e2e/SKILL.md'), 'utf-8')
    assert.ok(!skill.includes('## Procedures'), 'the procedures table must not appear without the pack')
  })
})

test('every agent is a mapping, not an opinion', () => {
  const verbs = ['assess', 'decide', 'grade', 'severity', 'verdict', 'recommend', 'should']
  for (const agent of loadAgents(SKILLS_DIR)) {
    assert.match(agent.body, /^##[ \t]+Forbidden\b/m, `${agent.id} does not say what it must not return`)
    assert.ok(['haiku', 'sonnet', 'opus', 'inherit'].includes(agent.model), `${agent.id} has model "${agent.model}"`)
    for (const line of stripForbiddenSection(agent.body).split(/\r?\n/)) {
      if (/\b(?:not|never|no)\b/i.test(line)) continue
      for (const verb of verbs) {
        assert.ok(!new RegExp(`\\b${verb}\\b`, 'i').test(line), `${agent.id} asks for judgement: "${line.trim()}"`)
      }
    }
  }
})

test('mergeAllowedTools keeps the skill grant first and adds only what is new', () => {
  assert.equal(
    mergeAllowedTools('Bash(npx playwright:*), Read', [{ allowedTools: 'Read, Bash(gh run view:*)' }, { allowedTools: '' }, { allowedTools: 'Bash(npx playwright:*), Grep' }]),
    'Bash(npx playwright:*), Read, Bash(gh run view:*), Grep',
  )
  assert.equal(mergeAllowedTools('', []), '')
})

test('the skill grants every command its workflows run, and nothing extra without them', () => {
  const workflows = loadWorkflows(SKILLS_DIR)
  const declared = new Set(workflows.flatMap(w => allowedToolPrefixes(w.allowedTools)))
  const grantOf = (cwd: string, tree: string): string[] => {
    const { data } = parseFrontmatter(readFileSync(join(cwd, tree, 'playwright-e2e/SKILL.md'), 'utf-8'))
    return allowedToolPrefixes(typeof data['allowed-tools'] === 'string' ? data['allowed-tools'] : '')
  }

  withProject(['claude', 'agents'], ['core', 'workflows'], cwd => {
    for (const tree of ['.claude/skills', '.agents/skills']) {
      const granted = grantOf(cwd, tree)
      for (const prefix of declared) assert.ok(granted.includes(prefix), `${tree} SKILL.md does not grant Bash(${prefix}:*)`)
    }
  })

  withProject(['claude', 'agents'], ['core'], cwd => {
    for (const tree of ['.claude/skills', '.agents/skills']) {
      const granted = grantOf(cwd, tree)
      assert.ok(!granted.some(prefix => /^(?:gh|git)\b/.test(prefix)), `${tree} SKILL.md grants a workflow command without the workflows pack: ${granted.join(', ')}`)
    }
  })
})

test('no workflow pre-approves a merge, an approval or a push', () => {
  // Every grant a workflow declares lands in the skill's own grant, so a broad
  // one here would pre-approve these for every task the skill is loaded for.
  const forbidden = ['gh pr merge', 'gh pr review', 'git push', 'git rebase', 'git reset']
  for (const workflow of loadWorkflows(SKILLS_DIR)) {
    for (const prefix of allowedToolPrefixes(workflow.allowedTools)) {
      for (const command of forbidden) {
        const covers = command === prefix || command.startsWith(`${prefix} `)
        assert.ok(!covers, `${workflow.id} grants Bash(${prefix}:*), which covers \`${command}\``)
      }
    }
  }
})
