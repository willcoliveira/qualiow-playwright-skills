import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderTemplate, buildContext } from './template-engine.js'
import { generateClaude } from './platforms/claude.js'
import { generateCursor } from './platforms/cursor.js'
import { generateCopilot } from './platforms/copilot.js'
import { generateGeneric } from './platforms/generic.js'
import type { ProjectInfo } from './cli.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface GenerateOptions {
  platforms: string[]
  packs: string[]
  projectInfo: ProjectInfo
  cwd: string
}

export interface GenerateResult {
  filesCreated: number
  files: string[]
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const { platforms, packs, projectInfo, cwd } = options
  const ctx = buildContext(projectInfo)
  const files: string[] = []

  // Resolve skills directory (relative to this file in dist or source)
  const skillsDir = resolveSkillsDir()

  // Collect all skill files based on selected packs
  const skillFiles: SkillFile[] = []

  if (packs.includes('core')) {
    skillFiles.push(
      { type: 'core', name: 'playwright-patterns.md', content: readSkill(skillsDir, 'core/playwright-patterns.md') },
      { type: 'core', name: 'data-strategy.md', content: readSkill(skillsDir, 'core/data-strategy.md') },
      { type: 'core', name: 'test-review.md', content: readSkill(skillsDir, 'core/test-review.md') },
    )
  }

  if (packs.includes('playwright-cli')) {
    skillFiles.push(
      { type: 'playwright-cli', name: 'SKILL.md', content: readSkill(skillsDir, 'playwright-cli/SKILL.md') },
      { type: 'playwright-cli', name: 'references/request-mocking.md', content: readSkill(skillsDir, 'playwright-cli/references/request-mocking.md') },
      { type: 'playwright-cli', name: 'references/running-code.md', content: readSkill(skillsDir, 'playwright-cli/references/running-code.md') },
      { type: 'playwright-cli', name: 'references/session-management.md', content: readSkill(skillsDir, 'playwright-cli/references/session-management.md') },
      { type: 'playwright-cli', name: 'references/storage-state.md', content: readSkill(skillsDir, 'playwright-cli/references/storage-state.md') },
      { type: 'playwright-cli', name: 'references/test-generation.md', content: readSkill(skillsDir, 'playwright-cli/references/test-generation.md') },
      { type: 'playwright-cli', name: 'references/tracing.md', content: readSkill(skillsDir, 'playwright-cli/references/tracing.md') },
      { type: 'playwright-cli', name: 'references/video-recording.md', content: readSkill(skillsDir, 'playwright-cli/references/video-recording.md') },
    )
  }

  if (packs.includes('templates')) {
    skillFiles.push(
      { type: 'template', name: 'page-object-conventions.md', content: renderTemplate(readSkill(skillsDir, 'templates/page-object-conventions.md'), ctx) },
      { type: 'template', name: 'project-conventions.md', content: renderTemplate(readSkill(skillsDir, 'templates/project-conventions.md'), ctx) },
      { type: 'template', name: 'test-debugging.md', content: renderTemplate(readSkill(skillsDir, 'templates/test-debugging.md'), ctx) },
      { type: 'template', name: 'test-generation.md', content: renderTemplate(readSkill(skillsDir, 'templates/test-generation.md'), ctx) },
      { type: 'template', name: 'test-planning.md', content: renderTemplate(readSkill(skillsDir, 'templates/test-planning.md'), ctx) },
    )
  }

  // Generate for each platform
  for (const platform of platforms) {
    let platformFiles: string[]

    switch (platform) {
      case 'claude':
        platformFiles = generateClaude(cwd, skillFiles, skillsDir)
        break
      case 'cursor':
        platformFiles = generateCursor(cwd, skillFiles, skillsDir)
        break
      case 'copilot':
        platformFiles = generateCopilot(cwd, skillFiles, skillsDir)
        break
      case 'generic':
        platformFiles = generateGeneric(cwd, skillFiles, skillsDir)
        break
      default:
        continue
    }

    files.push(...platformFiles)
  }

  return {
    filesCreated: files.length,
    files,
  }
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

export function writeFile(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, content, 'utf-8')
}

export function relativePath(cwd: string, fullPath: string): string {
  return relative(cwd, fullPath)
}
