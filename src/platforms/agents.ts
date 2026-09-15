import { join } from 'node:path'
import type { PlannedFile, SkillFile, PlanMeta, Workflow, AgentDef } from '../generator.js'
import type { TemplateContext } from '../template-engine.js'
import { planSkillsDir } from './skills-dir.js'

export const AGENTS_SKILLS_ROOT = ['.agents', 'skills'] as const

/**
 * `.agents/skills/<name>/SKILL.md` is the cross-tool Agent Skills location read
 * by Cursor, GitHub Copilot, Codex and Gemini CLI. Cursor and Copilot reuse it
 * and only add a small pointer file of their own.
 */
export function planAgents(cwd: string, skillFiles: SkillFile[], workflows: Workflow[], agents: AgentDef[], skillsDir: string, ctx: TemplateContext, meta: PlanMeta): PlannedFile[] {
  return planSkillsDir(join(cwd, ...AGENTS_SKILLS_ROOT), skillFiles, workflows, skillsDir, ctx, meta)
}
