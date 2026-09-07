import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve, relative, sep } from 'node:path'
import { parseFrontmatter } from './frontmatter.js'
import { findUnrenderedTemplate } from './template-engine.js'

/**
 * Checks a generated output tree (a project directory after `init`) against
 * the Agent Skills spec and against the mistakes this generator has made in
 * the past. Used by the test suite and by `scripts/validate-output.ts` in CI.
 */

export interface ValidationIssue {
  /** Path relative to the validated root, POSIX separators. */
  file: string
  message: string
}

const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_SKILL_NAME_LENGTH = 64
const MAX_DESCRIPTION_LENGTH = 1024
const MAX_SKILL_BODY_LINES = 500

/** Directories under the root that are never ours to validate (e.g. node_modules). */
const SKIPPED_DIRS = new Set(['node_modules', '.git'])

export function validateOutputTree(root: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const file of listMarkdownFiles(root)) {
    const text = readFileSync(file, 'utf-8')
    const rel = relative(root, file).split(sep).join('/')
    const report = (message: string) => issues.push({ file: rel, message })

    const unrendered = findUnrenderedTemplate(text)
    if (unrendered) report(`unrendered template syntax: ${unrendered}`)

    for (const link of findRelativeReferences(text)) {
      const base = link.startsWith('.') && !link.startsWith('./') && !link.startsWith('../') ? root : dirname(file)
      if (!existsSync(resolve(base, link))) report(`broken reference: ${link}`)
    }

    if (/--selector\b/.test(text)) report('uses the non-existent `snapshot --selector` flag')
    if (/browser\.bind\(\s*\)/.test(text)) report('`browser.bind()` requires a session name argument')

    const name = basename(file)
    if (name === 'SKILL.md') validateSkillFile(file, text, report)
    else if (name.endsWith('.mdc')) validateCursorRule(text, report)
    else if (name.endsWith('.instructions.md')) validateCopilotInstructions(text, report)
  }
  return issues
}

function validateSkillFile(file: string, text: string, report: (message: string) => void): void {
  const { data, body, hasFrontmatter } = parseFrontmatter(text)
  if (!hasFrontmatter) {
    report('SKILL.md has no YAML frontmatter')
    return
  }
  const name = data.name
  if (typeof name !== 'string' || name === '') {
    report('frontmatter `name` is missing')
  } else {
    if (!SKILL_NAME_RE.test(name)) report(`frontmatter \`name\` "${name}" must be lowercase letters, digits and single hyphens`)
    if (name.length > MAX_SKILL_NAME_LENGTH) report(`frontmatter \`name\` is longer than ${MAX_SKILL_NAME_LENGTH} characters`)
    const dir = basename(dirname(file))
    if (name !== dir) report(`frontmatter \`name\` "${name}" must equal the directory name "${dir}"`)
  }
  const description = data.description
  if (typeof description !== 'string' || description.trim() === '') {
    report('frontmatter `description` is missing')
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    report(`frontmatter \`description\` is longer than ${MAX_DESCRIPTION_LENGTH} characters`)
  }
  const bodyLines = body.split('\n').length
  if (bodyLines >= MAX_SKILL_BODY_LINES) report(`SKILL.md body has ${bodyLines} lines; keep it under ${MAX_SKILL_BODY_LINES}`)
}

function validateCursorRule(text: string, report: (message: string) => void): void {
  const { data, hasFrontmatter } = parseFrontmatter(text)
  if (!hasFrontmatter) {
    report('Cursor rule has no frontmatter')
    return
  }
  for (const key of ['description', 'globs', 'alwaysApply']) {
    if (!(key in data)) report(`Cursor rule frontmatter is missing \`${key}\``)
  }
  if (/^globs:[ \t]*["']/m.test(text)) report('Cursor rule `globs` must not be quoted')
  if (data.alwaysApply !== undefined && data.alwaysApply !== 'true' && data.alwaysApply !== 'false') {
    report('Cursor rule `alwaysApply` must be true or false')
  }
}

function validateCopilotInstructions(text: string, report: (message: string) => void): void {
  const { data, hasFrontmatter } = parseFrontmatter(text)
  if (!hasFrontmatter || typeof data.applyTo !== 'string' || data.applyTo === '') {
    report('Copilot instructions file needs an `applyTo` frontmatter key')
  }
}

/**
 * Relative references to markdown files: `[text](path.md)` links and
 * backticked paths such as `references/foo.md`, `../bar.md`, `foo.md` or
 * `.agents/skills/x/SKILL.md` (root-relative). URLs and globs are ignored.
 */
export function findRelativeReferences(text: string): string[] {
  const refs = new Set<string>()
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+\.md)(?:#[^)]*)?\)/g)) refs.add(match[1])
  for (const match of text.matchAll(/`([^`\s]+\.md)`/g)) refs.add(match[1])
  return [...refs].filter(ref => !/^[a-z]+:/i.test(ref) && !/[*{}<>]/.test(ref))
}

function listMarkdownFiles(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(md|mdc)$/.test(entry.name))
    .map(entry => join(entry.parentPath, entry.name))
    .filter(file => !relative(root, file).split(sep).some(part => SKIPPED_DIRS.has(part)))
    .sort()
}
