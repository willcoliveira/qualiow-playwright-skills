import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve, relative, sep } from 'node:path'
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
  const grants = collectSkillGrants(root)
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

    // Files outside a skill directory (Cursor rules, Copilot instructions) are
    // read as context, never executed, so they carry no grant to check against.
    const grant = grantFor(grants, file)
    if (grant !== null) validateBashFences(text, grant, report)

    const name = basename(file)
    if (name === 'SKILL.md') validateSkillFile(file, text, report)
    else if (name.endsWith('.mdc')) validateCursorRule(text, report)
    else if (name.endsWith('.instructions.md')) validateCopilotInstructions(text, report)
  }

  for (const grant of grants) {
    for (const prefix of grant.prefixes) {
      if (grant.used.has(prefix)) continue
      issues.push({
        file: relative(root, grant.file).split(sep).join('/'),
        message: `\`allowed-tools\` grants \`Bash(${prefix}:*)\` but no command in the skill uses it`,
      })
    }
  }
  return issues
}

/**
 * Every command the prose tells the agent to run must be a shell builtin or be
 * covered by the skill's own `allowed-tools`. A violation here is a generator
 * bug: we write both the grant and the prose, so they cannot disagree by
 * accident the way a hand-authored skill's can.
 */
function validateBashFences(text: string, grant: SkillGrant, report: (message: string) => void): void {
  for (const block of extractBashBlocks(text)) {
    for (const line of block) {
      const check = checkBashLine(line, grant.prefixes)
      if (check.envAssignment) {
        report(
          `\`${check.token}\` starts a command line; permission rules match the first literal ` +
            'token, so a VAR=value prefix can never match a Bash(...) grant — move it to its own `export` line',
        )
      } else if (check.prefix !== null) {
        grant.used.add(check.prefix)
      } else if (!check.builtin) {
        report(`\`${check.token}\` is neither a shell builtin nor covered by \`allowed-tools\``)
      }
    }
  }
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

/**
 * Commands a skill may run without a grant. `npx` and `node` are deliberately
 * absent: they launch arbitrary code and must be granted explicitly.
 */
const SHELL_BUILTINS = new Set([
  'awk', 'cat', 'cd', 'cp', 'diff', 'do', 'done', 'echo', 'elif', 'else', 'esac',
  'export', 'fi', 'for', 'grep', 'head', 'if', 'ls', 'mkdir', 'mv', 'printf',
  'read', 'rm', 'sed', 'sort', 'tail', 'tee', 'test', 'then', 'uniq', 'wc', 'while',
])

/** `Bash(npx playwright:*)` -> `npx playwright`. Non-Bash entries are ignored. */
export function allowedToolPrefixes(allowedTools: string): string[] {
  const prefixes: string[] = []
  for (const match of allowedTools.matchAll(/Bash\(([^)]*?):\*\)/g)) {
    const prefix = match[1].trim()
    if (prefix !== '') prefixes.push(prefix)
  }
  // Longest first so `npx playwright` wins over `npx`; alphabetical within a
  // length so the order is deterministic across runs.
  return prefixes.sort((a, b) => b.length - a.length || a.localeCompare(b))
}

export interface BashLineCheck {
  /** The first literal token, exactly as the permission matcher sees it. */
  token: string
  /** The granted prefix covering this line, when one does. */
  prefix: string | null
  /** The first token is a `VAR=value` assignment, which can never match. */
  envAssignment: boolean
  builtin: boolean
}

export function checkBashLine(line: string, prefixes: readonly string[]): BashLineCheck {
  const token = line.split(/[ \t]+/)[0] ?? ''
  const envAssignment = /^[A-Za-z_][A-Za-z0-9_]*=/.test(token)
  const builtin = !envAssignment && SHELL_BUILTINS.has(token)
  let prefix: string | null = null
  if (!envAssignment && !builtin) {
    prefix = prefixes.find(p => line === p || line.startsWith(`${p} `)) ?? null
  }
  return { token, prefix, envAssignment, builtin }
}

interface SkillGrant {
  dir: string
  file: string
  prefixes: string[]
  used: Set<string>
}

function collectSkillGrants(root: string): SkillGrant[] {
  const grants: SkillGrant[] = []
  for (const file of listMarkdownFiles(root)) {
    if (basename(file) !== 'SKILL.md') continue
    const { data } = parseFrontmatter(readFileSync(file, 'utf-8'))
    const raw = typeof data['allowed-tools'] === 'string' ? data['allowed-tools'] : ''
    grants.push({ dir: dirname(file), file, prefixes: allowedToolPrefixes(raw), used: new Set() })
  }
  return grants
}

/** The innermost skill directory containing `file`, if any. */
function grantFor(grants: readonly SkillGrant[], file: string): SkillGrant | null {
  let best: SkillGrant | null = null
  for (const grant of grants) {
    const rel = relative(grant.dir, file)
    if (rel.startsWith('..') || isAbsolute(rel)) continue
    if (best === null || grant.dir.length > best.dir.length) best = grant
  }
  return best
}

function listMarkdownFiles(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(md|mdc)$/.test(entry.name))
    .map(entry => join(entry.parentPath, entry.name))
    .filter(file => !relative(root, file).split(sep).some(part => SKIPPED_DIRS.has(part)))
    .sort()
}
