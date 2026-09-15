import { serializeFrontmatter } from '../frontmatter.js'
import { PACKAGE_NAME } from '../generator.js'
import type { Workflow } from '../workflows.js'
import { SKILL_NAME, WORKFLOWS_SUBDIR } from './skills-dir.js'

/**
 * A command file is a pointer, not a copy.
 *
 * Every platform's command form wraps the same rendered body inside the skill
 * tree, so the procedure exists once and the wrappers differ only in
 * frontmatter and in which tree they point at. The ownership marker lives here
 * rather than in the body, so the bodies stay byte-identical across trees and
 * `migrate` can still recognise a command file as ours.
 */

export function ownershipMarker(id: string): string {
  return `<!-- ${PACKAGE_NAME}:${id} -->`
}

export function workflowBodyPath(skillsRoot: readonly string[], id: string): string {
  return [...skillsRoot, SKILL_NAME, WORKFLOWS_SUBDIR, `${id}.md`].join('/')
}

/**
 * @param frontmatter platform-specific keys, in the order the platform expects
 * @param skillsRoot the tree this platform reads, e.g. ['.claude', 'skills']
 * @param argumentLine how this platform receives the user's input, if at all
 */
export function wrapperContent(
  workflow: Workflow,
  frontmatter: Record<string, string>,
  skillsRoot: readonly string[],
  argumentLine: string,
): string {
  const path = workflowBodyPath(skillsRoot, workflow.id)
  return [
    serializeFrontmatter(frontmatter).trimEnd(),
    '',
    ownershipMarker(workflow.id),
    '',
    `# ${workflow.title}`,
    '',
    `Read \`${path}\` and follow it exactly — it is the whole procedure. Do not summarise it, skip`,
    'steps, or substitute an order of your own.',
    '',
    argumentLine,
    '',
  ].join('\n')
}
