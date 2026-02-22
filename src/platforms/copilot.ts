import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { writeFile, relativePath, type SkillFile } from '../generator.js'

/**
 * GitHub Copilot platform generator.
 *
 * Output structure:
 *   .github/copilot-instructions.md
 *
 * Copilot uses a single file. We start with the index template and append
 * all selected skill content into one consolidated document.
 */
export function generateCopilot(cwd: string, skillFiles: SkillFile[], skillsDir: string): string[] {
  const files: string[] = []
  const filePath = join(cwd, '.github', 'copilot-instructions.md')

  // Start with the consolidated copilot instructions index
  let content = readFileSync(join(skillsDir, 'indexes', 'copilot-instructions.md'), 'utf-8')

  // Append each selected skill file content
  if (skillFiles.length > 0) {
    content += '\n\n---\n\n# Detailed Skill References\n'

    for (const skill of skillFiles) {
      if (skill.type === 'playwright-cli' && skill.name !== 'SKILL.md') {
        // Skip granular playwright-cli references to keep the file manageable
        continue
      }
      content += `\n\n---\n\n${skill.content}`
    }
  }

  // If file already exists, append a separator and the new content
  let finalContent: string
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf-8')
    finalContent = `${existing}\n\n---\n\n${content}`
  } else {
    finalContent = content
  }

  writeFile(filePath, finalContent)
  files.push(relativePath(cwd, filePath))

  return files
}
