import { join } from 'node:path'
import type { PlannedFile, SkillFile, PlanMeta, Workflow, AgentDef } from '../generator.js'
import type { TemplateContext } from '../template-engine.js'
import { plannedFile } from '../generator.js'
import { serializeFrontmatter } from '../frontmatter.js'
import { planSkillsDir } from './skills-dir.js'
import { wrapperContent, ownershipMarker } from './wrappers.js'

export const CLAUDE_SKILLS_ROOT = ['.claude', 'skills'] as const

/**
 * Claude Code reads project skills from `.claude/skills/<name>/SKILL.md`, and is
 * the one target with a native slash command and a native sub-agent.
 */
export function planClaude(cwd: string, skillFiles: SkillFile[], workflows: Workflow[], agents: AgentDef[], skillsDir: string, ctx: TemplateContext, meta: PlanMeta): PlannedFile[] {
  const files = planSkillsDir(join(cwd, ...CLAUDE_SKILLS_ROOT), skillFiles, workflows, skillsDir, ctx, meta)

  for (const workflow of workflows) {
    const frontmatter: Record<string, string> = { description: workflow.summary }
    if (workflow.argumentHint !== '') frontmatter['argument-hint'] = workflow.argumentHint
    if (workflow.allowedTools !== '') frontmatter['allowed-tools'] = workflow.allowedTools
    files.push(plannedFile(
      join(cwd, '.claude', 'commands', `${workflow.id}.md`),
      wrapperContent(workflow, frontmatter, CLAUDE_SKILLS_ROOT, 'The request is: $ARGUMENTS'),
    ))
  }

  for (const agent of agents) {
    files.push(plannedFile(join(cwd, '.claude', 'agents', `${agent.id}.md`), agentContent(agent)))
  }

  return files
}

/**
 * Sub-agents exist on Claude Code and nowhere else, so they are written to be an
 * optimisation rather than a capability: each maps files to one artifact and
 * makes no judgement, which means running the same work inline produces the same
 * artifact and the other three platforms lose nothing but the context saving.
 */
function agentContent(agent: AgentDef): string {
  const frontmatter: Record<string, string> = {
    name: agent.id,
    description: agent.description,
    tools: agent.tools,
    model: agent.model,
  }
  return `${serializeFrontmatter(frontmatter)}\n${ownershipMarker(agent.id)}\n\n${agent.body}`
}
