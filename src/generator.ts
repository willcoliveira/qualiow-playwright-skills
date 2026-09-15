import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderTemplate, buildContext, type TemplateContext } from './template-engine.js'
import { planClaude } from './platforms/claude.js'
import { planCursor } from './platforms/cursor.js'
import { planCopilot } from './platforms/copilot.js'
import { planAgents } from './platforms/agents.js'
import { loadWorkflows, loadAgents, type Workflow, type AgentDef } from './workflows.js'
import { getVersion } from './version.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const PACKAGE_NAME = 'wico-playwright-agent-skills'

export const PLATFORMS = ['claude', 'cursor', 'copilot', 'agents'] as const
export type Platform = (typeof PLATFORMS)[number]
/** Accepted on the command line / in prompts; `generic` is the pre-2.0 name of `agents`. */
export const PLATFORM_ALIASES: Record<string, Platform> = { generic: 'agents' }

export const PACKS = ['core', 'templates', 'workflows', 'playwright-cli'] as const
export type Pack = (typeof PACKS)[number]
/**
 * Packs that ship `references/`. `workflows` drives its own planner step and
 * `playwright-cli` is handled by the installer bridge, so neither is listed here.
 */
const CONTENT_PACKS = ['core', 'templates'] as const satisfies readonly Pack[]

export interface ProjectInfo {
  projectName: string
  baseUrl: string
  fixtureImportPath: string
  pageObjectsDir: string
  testDir: string
}

export interface GenerateOptions {
  platforms: string[]
  packs: string[]
  projectInfo: ProjectInfo
  cwd: string
  meetsMinPlaywrightVersion: boolean
  /** Override the bundled skills directory (tests). */
  skillsDir?: string
  /** Override the version stamped into generated frontmatter (tests). */
  generatorVersion?: string
}

export type FileStatus = 'new' | 'unchanged' | 'modified'

export interface PlannedFile {
  path: string
  content: string
  /** Whether a file already exists at `path` (kept for callers of 1.x). */
  exists: boolean
  status: FileStatus
  /** `merge` files preserve hand-written content around a marker block. */
  mode: 'replace' | 'merge'
}

export interface SkillFile {
  pack: (typeof CONTENT_PACKS)[number]
  /** POSIX-style path relative to the pack directory, e.g. `playwright-patterns.md`. */
  name: string
  content: string
}

export interface PlanMeta {
  generatorVersion: string
}

export function normalizePlatform(id: string): Platform {
  const normalized = PLATFORM_ALIASES[id] ?? id
  if (!(PLATFORMS as readonly string[]).includes(normalized)) {
    throw new Error(`Unknown platform: ${id}`)
  }
  return normalized as Platform
}

export function normalizePack(id: string): Pack {
  if (!(PACKS as readonly string[]).includes(id)) {
    throw new Error(`Unknown pack: ${id}`)
  }
  return id as Pack
}

/** `core` is the base every index links to, so it is always part of a plan. */
export function withRequiredPacks(packs: readonly string[]): Pack[] {
  return [...new Set<Pack>(['core', ...packs.map(normalizePack)])]
}

/**
 * Computes every file that would be written, without touching the disk.
 * The CLI uses this for `--dry-run`, for an accurate new/updated/unchanged
 * summary, and to warn before overwriting existing files.
 */
export function plan(options: GenerateOptions): PlannedFile[] {
  const packs = withRequiredPacks(options.packs.map(normalizePack))
  const platforms = [...new Set(options.platforms.map(normalizePlatform))]
  const ctx = buildContext(options.projectInfo, { meetsMinPlaywrightVersion: options.meetsMinPlaywrightVersion, packs })
  const meta: PlanMeta = { generatorVersion: options.generatorVersion ?? getVersion() }

  const skillsDir = options.skillsDir ?? resolveSkillsDir()
  const skillFiles = collectSkillFiles(skillsDir, packs, ctx)
  const workflows = packs.includes('workflows') ? loadWorkflows(skillsDir) : []
  const agents = packs.includes('workflows') ? loadAgents(skillsDir) : []

  const planned: PlannedFile[] = []
  for (const platform of platforms) {
    switch (platform) {
      case 'claude':
        planned.push(...planClaude(options.cwd, skillFiles, workflows, agents, skillsDir, ctx, meta))
        break
      case 'cursor':
        planned.push(...planCursor(options.cwd, skillFiles, workflows, agents, skillsDir, ctx, meta))
        break
      case 'copilot':
        planned.push(...planCopilot(options.cwd, skillFiles, workflows, agents, skillsDir, ctx, meta))
        break
      case 'agents':
        planned.push(...planAgents(options.cwd, skillFiles, workflows, agents, skillsDir, ctx, meta))
        break
    }
  }

  return dedupePlanned(planned)
}

/** Several platforms share `.agents/skills`; identical files are planned once. */
function dedupePlanned(planned: PlannedFile[]): PlannedFile[] {
  const byPath = new Map<string, PlannedFile>()
  for (const file of planned) {
    const key = resolve(file.path)
    const existing = byPath.get(key)
    if (!existing) {
      byPath.set(key, file)
    } else if (existing.content !== file.content) {
      throw new Error(`Conflicting content planned for ${file.path}`)
    }
  }
  return [...byPath.values()]
}

/** Writes new and modified files; unchanged files are skipped. Returns written paths. */
export function writePlannedFiles(planned: PlannedFile[]): string[] {
  const written: string[] = []
  for (const file of planned) {
    if (file.status === 'unchanged') continue
    writeFile(file.path, file.content)
    written.push(file.path)
  }
  return written
}

export function collectSkillFiles(skillsDir: string, packs: readonly string[], ctx: TemplateContext): SkillFile[] {
  const skillFiles: SkillFile[] = []
  for (const pack of CONTENT_PACKS) {
    if (!packs.includes(pack)) continue
    for (const name of listPackFiles(join(skillsDir, pack))) {
      skillFiles.push({ pack, name, content: renderTemplate(readSkill(skillsDir, `${pack}/${name}`), ctx) })
    }
  }
  return skillFiles
}

/** Lists every `.md` file under `dir` (recursively) as sorted POSIX-relative names. */
export function listPackFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort()
}

function resolveSkillsDir(): string {
  // Walk up from this module until we find our own package.json; `skills/`
  // sits next to it both in the repo (src/) and in the published package (dist/bin/).
  let dir = __dirname
  for (let i = 0; i < 5; i++) {
    const pkgPath = join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.name === PACKAGE_NAME) {
          const skills = join(dir, 'skills')
          if (existsSync(skills)) return skills
        }
      } catch {}
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`Could not find the bundled skills directory next to ${PACKAGE_NAME}/package.json (searched upwards from ${__dirname})`)
}

export function readSkill(skillsDir: string, relPath: string): string {
  const fullPath = join(skillsDir, relPath)
  if (!existsSync(fullPath)) {
    throw new Error(`Bundled skill file is missing: ${relPath} (looked in ${skillsDir})`)
  }
  return readFileSync(fullPath, 'utf-8')
}

export function plannedFile(path: string, content: string, mode: PlannedFile['mode'] = 'replace'): PlannedFile {
  const exists = existsSync(path)
  let status: FileStatus = 'new'
  if (exists) {
    let current: string | null = null
    try {
      current = readFileSync(path, 'utf-8')
    } catch {}
    status = current === content ? 'unchanged' : 'modified'
  }
  return { path, content, exists, status, mode }
}

export function writeFile(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, content, 'utf-8')
}

export function relativePath(cwd: string, fullPath: string): string {
  return relative(cwd, fullPath).split(sep).join('/')
}

export type { Workflow, AgentDef }
