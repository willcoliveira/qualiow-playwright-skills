import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { writeFile, relativePath, type SkillFile } from '../generator.js'

/**
 * Generic platform generator.
 *
 * Output structure:
 *   .agent-skills/SKILL.md
 *   .agent-skills/references/*.md
 *   .agent-skills/references/playwright-cli/SKILL.md
 *   .agent-skills/references/playwright-cli/references/*.md
 */
export function generateGeneric(cwd: string, skillFiles: SkillFile[], skillsDir: string): string[] {
  const files: string[] = []
  const baseDir = join(cwd, '.agent-skills')
  const refsDir = join(baseDir, 'references')

  // Write SKILL.md index
  const indexContent = readFileSync(join(skillsDir, 'indexes', 'skill-index.md'), 'utf-8')
  const indexPath = join(baseDir, 'SKILL.md')
  writeFile(indexPath, indexContent)
  files.push(relativePath(cwd, indexPath))

  // Write core + template files as references
  for (const skill of skillFiles) {
    if (skill.type === 'core' || skill.type === 'template') {
      const filePath = join(refsDir, skill.name)
      writeFile(filePath, skill.content)
      files.push(relativePath(cwd, filePath))
    }
  }

  // Write playwright-cli as a nested skill
  const hasPlaywrightCli = skillFiles.some(s => s.type === 'playwright-cli')
  if (hasPlaywrightCli) {
    const cliDir = join(refsDir, 'playwright-cli')

    for (const skill of skillFiles) {
      if (skill.type === 'playwright-cli') {
        const filePath = join(cliDir, skill.name)
        writeFile(filePath, skill.content)
        files.push(relativePath(cwd, filePath))
      }
    }
  }

  return files
}
