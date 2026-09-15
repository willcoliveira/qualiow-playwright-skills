import { join } from 'node:path'
import { plannedFile, readSkill, type PlannedFile, type SkillFile, type PlanMeta, type Workflow, type AgentDef } from '../generator.js'
import { renderTemplate, type TemplateContext } from '../template-engine.js'
import { planAgents, AGENTS_SKILLS_ROOT } from './agents.js'
import { wrapperContent } from './wrappers.js'

/**
 * Cursor reads Agent Skills from `.agents/skills/`. On top of that we write a
 * single auto-attached rule that summarises the key rules and points at the
 * skill, so the guidance shows up whenever a spec or page object is open, plus
 * one command per workflow.
 *
 *   .agents/skills/playwright-e2e/...
 *   .cursor/rules/playwright-e2e.mdc
 *   .cursor/commands/<id>.md
 */
export function planCursor(cwd: string, skillFiles: SkillFile[], workflows: Workflow[], agents: AgentDef[], skillsDir: string, ctx: TemplateContext, meta: PlanMeta): PlannedFile[] {
  const rule = renderTemplate(readSkill(skillsDir, 'indexes/cursor-rules.mdc'), ctx)
  const commands = workflows.map(workflow => plannedFile(
    join(cwd, '.cursor', 'commands', `${workflow.id}.md`),
    wrapperContent(workflow, { description: workflow.summary }, AGENTS_SKILLS_ROOT, 'The request follows this line.'),
  ))
  return [
    ...planAgents(cwd, skillFiles, workflows, agents, skillsDir, ctx, meta),
    plannedFile(join(cwd, '.cursor', 'rules', 'playwright-e2e.mdc'), rule),
    ...commands,
  ]
}
