import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { writeFile, relativePath, type SkillFile } from '../generator.js'

/**
 * Claude Code platform generator.
 *
 * Output structure:
 *   .claude/skills/playwright-e2e/SKILL.md
 *   .claude/skills/playwright-e2e/references/*.md
 *   .claude/skills/playwright-cli/SKILL.md
 *   .claude/skills/playwright-cli/references/*.md
 */
export function generateClaude(cwd: string, skillFiles: SkillFile[], skillsDir: string): string[] {
  const files: string[] = []
  const baseDir = join(cwd, '.claude', 'skills')

  // Generate the main skill (e2e references)
  const e2eDir = join(baseDir, 'playwright-e2e')
  const refsDir = join(e2eDir, 'references')

  // Write SKILL.md index
  const indexContent = readFileSync(join(skillsDir, 'indexes', 'claude-skill.md'), 'utf-8')
  const indexPath = join(e2eDir, 'SKILL.md')
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

  // Write playwright-cli skill (its own skill directory)
  const hasPlaywrightCli = skillFiles.some(s => s.type === 'playwright-cli')
  if (hasPlaywrightCli) {
    const cliDir = join(baseDir, 'playwright-cli')

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
