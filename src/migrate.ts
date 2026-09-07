import { existsSync, readFileSync, readdirSync, rmSync, rmdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseFrontmatter } from './frontmatter.js'
import { PACKAGE_NAME, type PlannedFile } from './generator.js'
import { SKILL_NAME } from './platforms/skills-dir.js'

export interface LegacyItem {
  /** Absolute path. */
  path: string
  kind: 'file' | 'dir'
  reason: string
}

/**
 * Frontmatter descriptions written by the 1.x Cursor generator, one per skill
 * file. A rule is only treated as ours when its description still matches.
 */
export const LEGACY_CURSOR_RULE_DESCRIPTIONS: Record<string, string> = {
  'playwright-patterns': 'Playwright API patterns: waitForResponse, toPass, expect.poll, network-first safeguards',
  'data-strategy': 'Test data strategy: static vs dynamic factories',
  'test-review': 'Test review checklist: assertions, selectors, timing, isolation, POM, readability, reliability',
  'page-object-conventions': 'Page Object Model conventions: class structure, selectors, component composition',
  'project-conventions': "Project conventions: MUST/SHOULD/WON'T rules, file organization, CI/CD",
  'test-debugging': 'Test debugging: failure patterns, root cause classification, decision tree',
  'test-generation': 'Test generation: templates, import rules, fixture docs, page factory',
  'test-planning': 'Test planning: exploration workflow, plan template, checklist',
  'playwright-cli': 'Playwright CLI: browser automation commands for testing and exploration',
}

const SKILL_ROOTS = [['.claude', 'skills'], ['.agents', 'skills']] as const

/**
 * Finds output left behind by 1.x (or by an earlier 2.x run with different
 * packs) that the current plan no longer produces. Nothing is removed here;
 * the CLI shows the list and removes it only on confirmation or `--clean-legacy`.
 *
 * Every check requires positive evidence that we wrote the file: a generator
 * marker, the 1.x index wording, or the exact 1.x rule descriptions. Official
 * Playwright skills and hand-written files are never flagged.
 */
export function detectLegacyOutputs(cwd: string, planned: readonly PlannedFile[] = []): LegacyItem[] {
  const items: LegacyItem[] = []
  const plannedPaths = new Set(planned.map(file => resolve(file.path)))

  // 1.x "generic" platform output; no tool reads this directory.
  const agentSkillsDir = join(cwd, '.agent-skills')
  const agentSkillsIndex = join(agentSkillsDir, 'SKILL.md')
  if (existsSync(agentSkillsIndex) && isLegacyIndex(readText(agentSkillsIndex))) {
    items.push({ path: agentSkillsDir, kind: 'dir', reason: '1.x generic output; replaced by .agents/skills/playwright-e2e/ (nothing reads .agent-skills/)' })
  }

  // 1.x per-skill Cursor rules; replaced by one pointer rule + .agents/skills.
  for (const [name, description] of Object.entries(LEGACY_CURSOR_RULE_DESCRIPTIONS)) {
    const rule = join(cwd, '.cursor', 'rules', `${name}.mdc`)
    if (!existsSync(rule)) continue
    const { data } = parseFrontmatter(readText(rule))
    if (data.description === description) {
      items.push({ path: rule, kind: 'file', reason: '1.x per-skill Cursor rule; replaced by .cursor/rules/playwright-e2e.mdc + .agents/skills/playwright-e2e/' })
    }
  }

  // References inside skill directories we own that the current plan does not produce.
  for (const root of SKILL_ROOTS) {
    const skillDir = join(cwd, ...root, SKILL_NAME)
    const index = join(skillDir, 'SKILL.md')
    if (!plannedPaths.has(resolve(index))) continue // not generating for this root this run
    if (!existsSync(index) || !isOurs(readText(index))) continue
    const refsDir = join(skillDir, 'references')
    if (!existsSync(refsDir)) continue
    for (const entry of readdirSync(refsDir, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const full = join(entry.parentPath, entry.name)
      if (plannedPaths.has(resolve(full))) continue
      items.push({ path: full, kind: 'file', reason: 'not produced by the current packs (keep it if you added it by hand)' })
    }
  }

  // 1.x vendored copy of the playwright-cli skill (the official installer now owns this path).
  const vendoredDir = join(cwd, '.claude', 'skills', 'playwright-cli')
  const vendoredIndex = join(vendoredDir, 'SKILL.md')
  if (existsSync(vendoredIndex)) {
    const reason = vendoredPlaywrightCliReason(readText(vendoredIndex))
    if (reason) items.push({ path: vendoredDir, kind: 'dir', reason })
  }

  return items
}

export function removeLegacyOutputs(items: readonly LegacyItem[]): string[] {
  const removed: string[] = []
  for (const item of items) {
    if (!existsSync(item.path)) continue
    rmSync(item.path, { recursive: true, force: true })
    removed.push(item.path)
    if (item.kind === 'file') pruneEmptyDir(dirname(item.path))
  }
  return removed
}

function pruneEmptyDir(dir: string): void {
  try {
    if (readdirSync(dir).length === 0) rmdirSync(dir)
  } catch {}
}

/** SKILL.md written by this generator: 2.x metadata marker or the 1.x index wording. */
export function isOurs(skillMd: string): boolean {
  const { data, hasFrontmatter } = parseFrontmatter(skillMd)
  const metadata = data.metadata
  if (typeof metadata === 'object' && metadata.generator === PACKAGE_NAME) return true
  return !hasFrontmatter && isLegacyIndex(skillMd)
}

function isLegacyIndex(text: string): boolean {
  return text.startsWith('# Playwright E2E Skills') && text.includes('## Decision Tree')
}

function vendoredPlaywrightCliReason(skillMd: string): string | null {
  if (skillMd.includes('CLI Debug & Trace Analysis (Playwright v1.59+)') || skillMd.includes('Agent Debugging Workflow (v1.59+)')) {
    return '1.x vendored copy of the playwright-cli skill; reinstall the official one with `npx playwright cli install --skills`'
  }
  if (skillMd.includes('references/request-mocking.md') && !skillMd.includes('references/playwright-tests.md')) {
    return 'looks like the 1.x vendored copy of the playwright-cli skill (no playwright-tests.md reference); reinstall the official one with `npx playwright cli install --skills`'
  }
  return null
}

function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}
