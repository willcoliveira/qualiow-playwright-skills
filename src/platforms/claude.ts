import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { plannedFile, type PlannedFile, type SkillFile } from '../generator.js'
import { renderTemplate, type TemplateContext } from '../template-engine.js'

/**
 * Claude Code platform generator.
 *
 * Output structure:
 *   .claude/skills/playwright-e2e/SKILL.md
 *   .claude/skills/playwright-e2e/references/*.md
 *   .claude/skills/playwright-cli/SKILL.md
 *   .claude/skills/playwright-cli/references/*.md
 */
export function planClaude(cwd: string, skillFiles: SkillFile[], skillsDir: string, ctx: TemplateContext): PlannedFile[] {
  const files: PlannedFile[] = []
  const baseDir = join(cwd, '.claude', 'skills')

  // Generate the main skill (e2e references)
  const e2eDir = join(baseDir, 'playwright-e2e')
  const refsDir = join(e2eDir, 'references')

  // SKILL.md index
  const indexContent = renderTemplate(readFileSync(join(skillsDir, 'indexes', 'claude-skill.md'), 'utf-8'), ctx)
  files.push(plannedFile(join(e2eDir, 'SKILL.md'), indexContent))

  // Core + template files as references
  for (const skill of skillFiles) {
    if (skill.type === 'core' || skill.type === 'template') {
      files.push(plannedFile(join(refsDir, skill.name), skill.content))
    }
  }

  // playwright-cli skill (its own skill directory)
  const cliDir = join(baseDir, 'playwright-cli')
  for (const skill of skillFiles) {
    if (skill.type === 'playwright-cli') {
      files.push(plannedFile(join(cliDir, skill.name), skill.content))
    }
  }

  return files
}
