import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, relative, sep } from 'node:path'
import type { ValidationIssue } from './validate.js'

/**
 * The rule-drift gate.
 *
 * The same rules are stated in several places: the reference that owns them,
 * and the short summaries each platform reads first — the Cursor rule, the
 * Copilot instructions, the Copilot pointer block. Those summaries are written
 * by hand, so they drift, and a summary that has quietly lost a rule is worse
 * than one that never had it: the reader believes they have the list.
 *
 * The manifest names, per rule, one anchor string that must appear verbatim in
 * the owning reference and in every surface that restates it. Anchors are short
 * and distinctive on purpose — a whole sentence cannot survive being phrased
 * for a numbered constitution and for a six-word bullet, but the term of art at
 * its centre can.
 */

export interface RuleAnchor {
  /** Text that must appear verbatim in the owner and in every surface. */
  anchor: string
  /** Reference file that owns the rule, relative to the skill's `references/`. */
  owner: string
  /** Which generated summaries must restate it. */
  surfaces: string[]
  /** Short name, used in the failure message. */
  label: string
}

export const MANIFEST_FILE = 'rules.manifest.tsv'

/** Where each surface lands in a generated project, relative to its root. */
const SURFACE_FILES: Record<string, string> = {
  cursor: '.cursor/rules/playwright-e2e.mdc',
  copilot: '.github/instructions/playwright-e2e.instructions.md',
  pointer: '.github/copilot-instructions.md',
}

/** `skill` is every generated SKILL.md rather than one fixed path. */
const SKILL_SURFACE = 'skill'

export function parseRuleManifest(text: string): RuleAnchor[] {
  const rules: RuleAnchor[] = []
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === '' || line.trimStart().startsWith('#')) return
    const parts = line.split('\t').map(part => part.trim())
    if (parts.length !== 4 || parts.some(part => part === '')) {
      throw new Error(`${MANIFEST_FILE}:${index + 1}: expected anchor, owner, surfaces and label separated by tabs`)
    }
    const [anchor, owner, surfaces, label] = parts
    // `-` means the anchor has no summary to keep in step; the row exists only
    // to hold two references to the same wording.
    const list = surfaces === '-' ? [] : surfaces.split(',').map(s => s.trim()).filter(s => s !== '')
    for (const surface of list) {
      if (surface !== SKILL_SURFACE && !(surface in SURFACE_FILES)) {
        throw new Error(`${MANIFEST_FILE}:${index + 1}: unknown surface "${surface}"`)
      }
    }
    rules.push({ anchor, owner, surfaces: list, label })
  })
  return rules
}

export function loadRuleManifest(skillsDir: string): RuleAnchor[] {
  const path = join(skillsDir, MANIFEST_FILE)
  if (!existsSync(path)) throw new Error(`Rule manifest is missing: ${path}`)
  return parseRuleManifest(readFileSync(path, 'utf-8'))
}

/**
 * Checks a generated project tree against the manifest. A rule whose owning
 * reference was not installed is skipped rather than reported — the pack that
 * owns it was simply not selected — and so is a surface whose platform was not
 * selected. What is reported is a file that exists and has lost the rule.
 */
export function checkRuleDrift(root: string, manifest: readonly RuleAnchor[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const skillDirs = findSkillDirs(root)
  const rel = (full: string): string => relative(root, full).split(sep).join('/')

  for (const rule of manifest) {
    const owners = skillDirs
      .map(dir => join(dir, 'references', rule.owner))
      .filter(path => existsSync(path))
    if (owners.length === 0) continue

    for (const owner of owners) {
      if (!readFileSync(owner, 'utf-8').includes(rule.anchor)) {
        issues.push({ file: rel(owner), message: `owns rule "${rule.label}" but does not contain its anchor: ${rule.anchor}` })
      }
    }

    const targets: string[] = []
    for (const surface of rule.surfaces) {
      if (surface === SKILL_SURFACE) targets.push(...skillDirs.map(dir => join(dir, 'SKILL.md')))
      else targets.push(join(root, SURFACE_FILES[surface]))
    }

    for (const target of targets) {
      if (!existsSync(target)) continue
      if (!readFileSync(target, 'utf-8').includes(rule.anchor)) {
        issues.push({ file: rel(target), message: `restates the rules but has drifted from "${rule.label}"; missing anchor: ${rule.anchor}` })
      }
    }
  }
  return issues
}

function findSkillDirs(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name === 'SKILL.md')
    .map(entry => dirname(join(entry.parentPath, entry.name)))
    .filter(dir => basename(dir) !== '')
    .sort()
}
