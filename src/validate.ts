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

/** The only keys the Agent Skills spec gives a SKILL.md. */
const ALLOWED_SKILL_FRONTMATTER_KEYS = new Set([
  'name',
  'description',
  'allowed-tools',
  'license',
  'compatibility',
  'metadata',
])

/**
 * `key: >` / `key: |` block scalars. `parseFrontmatter` is deliberately not a
 * YAML parser: it stores the `>` itself as the value and drops the indented
 * continuation lines, so a folded description silently becomes ">".
 */
const BLOCK_SCALAR_RE = /^([\w.-]+):[ \t]*[|>][-+0-9]*[ \t]*$/

const FRONTMATTER_BLOCK_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

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

    const rootRelative = (ref: string): boolean =>
      ref.startsWith('.') && !ref.startsWith('./') && !ref.startsWith('../')
    for (const link of [...findRelativeReferences(text), ...findOwnedAssetReferences(text)]) {
      const base = rootRelative(link) ? root : dirname(file)
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

  const block = FRONTMATTER_BLOCK_RE.exec(text)
  if (block) {
    for (const line of block[1].split(/\r?\n/)) {
      const scalar = BLOCK_SCALAR_RE.exec(line)
      if (scalar) report(`frontmatter \`${scalar[1]}\` uses a YAML block scalar; put the value on one line`)
    }
  }

  for (const key of Object.keys(data)) {
    if (!ALLOWED_SKILL_FRONTMATTER_KEYS.has(key)) {
      report(`frontmatter key \`${key}\` is not part of the Agent Skills spec`)
    }
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

/**
 * The command lines inside each ```bash fence, with comments and blank lines
 * dropped. Used to resolve `node <path>` references and to check that every
 * command the prose orders is covered by the skill's own `allowed-tools`.
 */
export function extractBashBlocks(text: string): string[][] {
  const blocks: string[][] = []
  for (const match of text.matchAll(/^```(?:bash|sh|shell)[ \t]*\r?\n([\s\S]*?)^```/gm)) {
    const lines = match[1]
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line !== '' && !line.startsWith('#'))
    if (lines.length > 0) blocks.push(lines)
  }
  return blocks
}

const OWNED_PREFIX_RE = /^(?:references|scripts|assets)\/|^\.(?:claude|agents|github)\//
const ASSET_EXT_RE = /\.(?:mjs|cjs|js|ts|sh|json)$/
const RUN_COMMAND_RE = /^(?:node|bash|sh)[ \t]+("[^"]+"|'[^']+'|\S+)/

/**
 * Executable and data files this generator owns: backticked `scripts/x.mjs`,
 * markdown links to one, and `node scripts/x.mjs` inside a bash fence.
 *
 * The prefix gate is load-bearing. The references are full of illustrative
 * paths that belong to the reader's project — `src/pages/basket.page.ts`,
 * `playwright.config.ts`, `test-results/results.json` — and resolving those
 * against our tree would report a broken reference for every example we give.
 */
export function findOwnedAssetReferences(text: string): string[] {
  const refs = new Set<string>()
  const add = (ref: string): void => {
    if (!ASSET_EXT_RE.test(ref)) return
    if (/^[a-z]+:/i.test(ref) || /[*{}<>$]/.test(ref)) return
    if (!OWNED_PREFIX_RE.test(ref)) return
    refs.add(ref)
  }

  for (const match of text.matchAll(/`([^`\s]+)`/g)) add(match[1])
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) add(match[1])
  for (const block of extractBashBlocks(text)) {
    for (const line of block) {
      const run = RUN_COMMAND_RE.exec(line)
      if (run) add(run[1].replace(/^["']|["']$/g, ''))
    }
  }
  return [...refs]
}

function listMarkdownFiles(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(md|mdc)$/.test(entry.name))
    .map(entry => join(entry.parentPath, entry.name))
    .filter(file => !relative(root, file).split(sep).some(part => SKIPPED_DIRS.has(part)))
    .sort()
}
