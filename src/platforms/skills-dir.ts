import { join } from 'node:path'
import { plannedFile, readSkill, PACKAGE_NAME, type PlannedFile, type SkillFile, type PlanMeta, type Workflow } from '../generator.js'
import { renderTemplate, type TemplateContext } from '../template-engine.js'
import { withFrontmatter } from '../frontmatter.js'

export const SKILL_NAME = 'playwright-e2e'
export const WORKFLOWS_SUBDIR = 'workflows'

/**
 * Plans a standard Agent Skills directory:
 *
 *   <root>/playwright-e2e/SKILL.md          ← skills/indexes/skill.md
 *   <root>/playwright-e2e/references/*.md   ← selected core + template files
 *
 * The same layout serves `.claude/skills` (Claude Code) and `.agents/skills`
 * (Cursor, GitHub Copilot, Codex, Gemini CLI). The SKILL.md frontmatter is
 * stamped with generator metadata so later runs can recognise their own output.
 */
export function planSkillsDir(root: string, skillFiles: SkillFile[], workflows: Workflow[], skillsDir: string, ctx: TemplateContext, meta: PlanMeta): PlannedFile[] {
  const skillDir = join(root, SKILL_NAME)
  const files: PlannedFile[] = []

  const index = renderTemplate(readSkill(skillsDir, 'indexes/skill.md'), ctx)
  const stamped = withFrontmatter(index, {
    metadata: { generator: PACKAGE_NAME, 'generator-version': meta.generatorVersion },
  })
  files.push(plannedFile(join(skillDir, 'SKILL.md'), stamped))

  for (const skill of skillFiles) {
    files.push(plannedFile(join(skillDir, 'references', skill.name), skill.content))
  }

  // One body per workflow, identical in every skill tree. The per-platform
  // command files are wrappers around these; nothing here is duplicated.
  for (const workflow of workflows) {
    files.push(plannedFile(join(skillDir, WORKFLOWS_SUBDIR, `${workflow.id}.md`), renderTemplate(workflow.body, ctx)))
  }

  return files
}
