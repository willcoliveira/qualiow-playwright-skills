import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderTemplate, buildContext } from './template-engine.js'
import { planClaude } from './platforms/claude.js'
import { planCursor } from './platforms/cursor.js'
import { planCopilot } from './platforms/copilot.js'
import { planGeneric } from './platforms/generic.js'
import type { ProjectInfo } from './cli.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface GenerateOptions {
  platforms: string[]
  packs: string[]
  projectInfo: ProjectInfo
  cwd: string
  meetsMinPlaywrightVersion: boolean
}

export interface PlannedFile {
  path: string
  content: string
  exists: boolean
}

/**
 * Computes every file that would be written, without touching the disk.
 * The CLI uses this for an accurate file count and to warn before
 * overwriting existing files.
 */
export function plan(options: GenerateOptions): PlannedFile[] {
  const { platforms, packs, projectInfo, cwd, meetsMinPlaywrightVersion } = options
  const ctx = buildContext(projectInfo, { meetsMinPlaywrightVersion })

  const skillsDir = resolveSkillsDir()
  const skillFiles = collectSkillFiles(skillsDir, packs, ctx)

  const planned: PlannedFile[] = []

  for (const platform of platforms) {
    switch (platform) {
      case 'claude':
        planned.push(...planClaude(cwd, skillFiles, skillsDir, ctx))
        break
      case 'cursor':
        planned.push(...planCursor(cwd, skillFiles, skillsDir, ctx))
        break
      case 'copilot':
        planned.push(...planCopilot(cwd, skillFiles, skillsDir, ctx))
        break
      case 'generic':
        planned.push(...planGeneric(cwd, skillFiles, skillsDir, ctx))
        break
      default:
        throw new Error(`Unknown platform: ${platform}`)
    }
  }

  return planned
}

export function writePlannedFiles(planned: PlannedFile[]): string[] {
  const written: string[] = []
  for (const file of planned) {
    writeFile(file.path, file.content)
    written.push(file.path)
  }
  return written
}

function collectSkillFiles(skillsDir: string, packs: string[], ctx: ReturnType<typeof buildContext>): SkillFile[] {
  // All files go through renderTemplate to resolve version conditionals
  const skillFiles: SkillFile[] = []

  if (packs.includes('core')) {
    for (const name of ['playwright-patterns.md', 'data-strategy.md', 'test-review.md']) {
      skillFiles.push({ type: 'core', name, content: renderTemplate(readSkill(skillsDir, `core/${name}`), ctx) })
    }
  }

  if (packs.includes('playwright-cli')) {
    const cliFiles = [
      'SKILL.md',
      'references/request-mocking.md',
      'references/running-code.md',
      'references/session-management.md',
      'references/storage-state.md',
      'references/test-generation.md',
      'references/tracing.md',
      'references/video-recording.md',
    ]
    for (const name of cliFiles) {
      skillFiles.push({ type: 'playwright-cli', name, content: renderTemplate(readSkill(skillsDir, `playwright-cli/${name}`), ctx) })
    }
  }

  if (packs.includes('templates')) {
    const templateFiles = [
      'page-object-conventions.md',
      'project-conventions.md',
      'test-debugging.md',
      'test-generation.md',
      'test-planning.md',
    ]
    for (const name of templateFiles) {
      skillFiles.push({ type: 'template', name, content: renderTemplate(readSkill(skillsDir, `templates/${name}`), ctx) })
    }
  }

  return skillFiles
}

function resolveSkillsDir(): string {
  const candidates = [
    // Running from source (tsx): src/generator.ts → ../skills
    resolve(__dirname, '..', 'skills'),
    // Running from dist/src/generator.js or dist/bin/init.js → ../../skills
    resolve(__dirname, '..', '..', 'skills'),
    // Running from deeply nested dist (e.g. dist/src/) → ../../../skills
    resolve(__dirname, '..', '..', '..', 'skills'),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  throw new Error(`Could not find skills directory. Checked:\n${candidates.map(c => `  ${c}`).join('\n')}`)
}

function readSkill(skillsDir: string, relativePath: string): string {
  const fullPath = join(skillsDir, relativePath)
  return readFileSync(fullPath, 'utf-8')
}

export interface SkillFile {
  type: 'core' | 'template' | 'playwright-cli'
  name: string
  content: string
}

export function plannedFile(path: string, content: string): PlannedFile {
  return { path, content, exists: existsSync(path) }
}

export function writeFile(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, content, 'utf-8')
}

export function relativePath(cwd: string, fullPath: string): string {
  return relative(cwd, fullPath)
}
