import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { plannedFile, type PlannedFile, type SkillFile } from '../generator.js'
import { renderTemplate, type TemplateContext } from '../template-engine.js'

/**
 * Generic platform generator.
 *
 * Output structure:
 *   .agent-skills/SKILL.md
 *   .agent-skills/references/*.md
 *   .agent-skills/references/playwright-cli/SKILL.md
 *   .agent-skills/references/playwright-cli/references/*.md
 */
export function planGeneric(cwd: string, skillFiles: SkillFile[], skillsDir: string, ctx: TemplateContext): PlannedFile[] {
  const files: PlannedFile[] = []
  const baseDir = join(cwd, '.agent-skills')
  const refsDir = join(baseDir, 'references')

  // SKILL.md index
  const indexContent = renderTemplate(readFileSync(join(skillsDir, 'indexes', 'skill-index.md'), 'utf-8'), ctx)
  files.push(plannedFile(join(baseDir, 'SKILL.md'), indexContent))

  // Core + template files as references
  for (const skill of skillFiles) {
    if (skill.type === 'core' || skill.type === 'template') {
      files.push(plannedFile(join(refsDir, skill.name), skill.content))
    }
  }

  // playwright-cli as a nested skill
  const cliDir = join(refsDir, 'playwright-cli')
  for (const skill of skillFiles) {
    if (skill.type === 'playwright-cli') {
      files.push(plannedFile(join(cliDir, skill.name), skill.content))
    }
  }

  return files
}
