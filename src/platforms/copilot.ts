import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { plannedFile, type PlannedFile, type SkillFile } from '../generator.js'
import { renderTemplate, type TemplateContext } from '../template-engine.js'

const MARKER_START = '<!-- wico-playwright-agent-skills:start -->'
const MARKER_END = '<!-- wico-playwright-agent-skills:end -->'

/**
 * GitHub Copilot platform generator.
 *
 * Output structure:
 *   .github/copilot-instructions.md
 *
 * Copilot uses a single file. We start with the index template and append
 * all selected skill content into one consolidated document. The generated
 * section is wrapped in marker comments so re-running the CLI replaces the
 * previous section instead of duplicating it, and hand-written content
 * outside the markers is preserved.
 */
export function planCopilot(cwd: string, skillFiles: SkillFile[], skillsDir: string, ctx: TemplateContext): PlannedFile[] {
  const filePath = join(cwd, '.github', 'copilot-instructions.md')

  // Start with the consolidated copilot instructions index
  let content = renderTemplate(readFileSync(join(skillsDir, 'indexes', 'copilot-instructions.md'), 'utf-8'), ctx)

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

  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : null
  const finalContent = mergeCopilotContent(existing, content)

  return [plannedFile(filePath, finalContent)]
}

/**
 * Merges generated content into an existing copilot-instructions.md.
 * Replaces a previously generated marker block if present; otherwise
 * appends the block after any existing hand-written content.
 */
export function mergeCopilotContent(existing: string | null, generated: string): string {
  const block = `${MARKER_START}\n\n${generated}\n\n${MARKER_END}`

  if (existing === null || existing.trim() === '') {
    return block
  }

  const startIdx = existing.indexOf(MARKER_START)
  const endIdx = existing.indexOf(MARKER_END)

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace the previously generated section, keep everything around it
    const before = existing.slice(0, startIdx)
    const after = existing.slice(endIdx + MARKER_END.length)
    return `${before}${block}${after}`
  }

  // No markers yet (hand-written file or pre-1.2 output): append once
  return `${existing.trimEnd()}\n\n${block}\n`
}
