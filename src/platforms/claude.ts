import { join } from 'node:path'
import type { PlannedFile, SkillFile, PlanMeta } from '../generator.js'
import type { TemplateContext } from '../template-engine.js'
import { planSkillsDir } from './skills-dir.js'

/** Claude Code reads project skills from `.claude/skills/<name>/SKILL.md`. */
export function planClaude(cwd: string, skillFiles: SkillFile[], skillsDir: string, ctx: TemplateContext, meta: PlanMeta): PlannedFile[] {
  return planSkillsDir(join(cwd, '.claude', 'skills'), skillFiles, skillsDir, ctx, meta)
}
