import { join } from 'node:path'
import { plannedFile, readSkill, type PlannedFile, type SkillFile, type PlanMeta, type Workflow, type AgentDef } from '../generator.js'
import { renderTemplate, type TemplateContext } from '../template-engine.js'
import { planAgents } from './agents.js'

/**
 * Cursor reads Agent Skills from `.agents/skills/`. On top of that we write a
 * single auto-attached rule that summarises the key rules and points at the
 * skill, so the guidance shows up whenever a spec or page object is open.
 *
 *   .agents/skills/playwright-e2e/...
 *   .cursor/rules/playwright-e2e.mdc
 */
export function planCursor(cwd: string, skillFiles: SkillFile[], workflows: Workflow[], agents: AgentDef[], skillsDir: string, ctx: TemplateContext, meta: PlanMeta): PlannedFile[] {
  const rule = renderTemplate(readSkill(skillsDir, 'indexes/cursor-rules.mdc'), ctx)
  return [
    ...planAgents(cwd, skillFiles, workflows, agents, skillsDir, ctx, meta),
    plannedFile(join(cwd, '.cursor', 'rules', 'playwright-e2e.mdc'), rule),
  ]
}
