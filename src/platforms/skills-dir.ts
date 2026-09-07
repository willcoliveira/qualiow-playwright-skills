import { join } from 'node:path'
import { plannedFile, readSkill, PACKAGE_NAME, type PlannedFile, type SkillFile, type PlanMeta } from '../generator.js'
import { renderTemplate, type TemplateContext } from '../template-engine.js'
import { withFrontmatter } from '../frontmatter.js'

export const SKILL_NAME = 'playwright-e2e'

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
export function planSkillsDir(root: string, skillFiles: SkillFile[], skillsDir: string, ctx: TemplateContext, meta: PlanMeta): PlannedFile[] {
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

  return files
}
