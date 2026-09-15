import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { plannedFile, readSkill, type PlannedFile, type SkillFile, type PlanMeta, type Workflow, type AgentDef } from '../generator.js'
import { renderTemplate, type TemplateContext } from '../template-engine.js'
import { planAgents } from './agents.js'

const MARKER_START = '<!-- wico-playwright-agent-skills:start -->'
const MARKER_END = '<!-- wico-playwright-agent-skills:end -->'

/**
 * GitHub Copilot reads Agent Skills from `.agents/skills/` (cloud agent, code
 * review, CLI, VS Code and JetBrains). We add two small files so the rules are
 * also present in Copilot's always-on context:
 *
 *   .agents/skills/playwright-e2e/...
 *   .github/instructions/playwright-e2e.instructions.md   (path-specific, `applyTo`)
 *   .github/copilot-instructions.md                        (short marker block, merged)
 *
 * The marker block replaces the block written by earlier versions, and any
 * hand-written content outside the markers is preserved.
 */
export function planCopilot(cwd: string, skillFiles: SkillFile[], workflows: Workflow[], agents: AgentDef[], skillsDir: string, ctx: TemplateContext, meta: PlanMeta): PlannedFile[] {
  const instructions = renderTemplate(readSkill(skillsDir, 'indexes/copilot-instructions.md'), ctx)
  const pointer = renderTemplate(readSkill(skillsDir, 'indexes/copilot-pointer.md'), ctx).trimEnd()

  const globalPath = join(cwd, '.github', 'copilot-instructions.md')
  const existing = existsSync(globalPath) ? readFileSync(globalPath, 'utf-8') : null

  return [
    ...planAgents(cwd, skillFiles, workflows, agents, skillsDir, ctx, meta),
    plannedFile(join(cwd, '.github', 'instructions', 'playwright-e2e.instructions.md'), instructions),
    plannedFile(globalPath, mergeCopilotContent(existing, pointer), 'merge'),
  ]
}

/**
 * Merges generated content into an existing copilot-instructions.md.
 * Replaces a previously generated marker block if present; otherwise
 * appends the block after any existing hand-written content.
 */
export function mergeCopilotContent(existing: string | null, generated: string): string {
  const block = `${MARKER_START}\n\n${generated}\n\n${MARKER_END}`

  if (existing === null || existing.trim() === '') {
    return `${block}\n`
  }

  const startIdx = existing.indexOf(MARKER_START)
  const endIdx = existing.indexOf(MARKER_END, startIdx === -1 ? 0 : startIdx)

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace the previously generated section, keep everything around it
    const before = existing.slice(0, startIdx)
    const after = existing.slice(endIdx + MARKER_END.length)
    return `${before}${block}${after}`
  }

  // No markers yet (hand-written file or pre-1.2 output): append once
  return `${existing.trimEnd()}\n\n${block}\n`
}
