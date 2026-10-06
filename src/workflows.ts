import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontmatter } from './frontmatter.js'

/**
 * Workflows and agents are authored once, in a platform-neutral form, and the
 * per-platform files are thin wrappers around the rendered body.
 *
 * That is what makes cross-platform parity a property of the build rather than
 * a discipline: the body lives at one path inside the skill, every platform's
 * command file points at the same path, and nothing can drift because nothing
 * is duplicated. Agents have no equivalent outside Claude Code, so they are
 * written to be an optimisation — a pure mapping from files to one artifact,
 * never a judgement — and the skill works without them.
 */

export const WORKFLOWS_DIR = 'workflows'
export const AGENTS_DIR = 'agents'

export interface Workflow {
  id: string
  title: string
  summary: string
  argumentHint: string
  allowedTools: string
  /** Everything after the neutral frontmatter, unrendered. */
  body: string
}

export interface AgentDef {
  id: string
  description: string
  tools: string
  model: string
  body: string
}

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function loadWorkflows(skillsDir: string): Workflow[] {
  return listSources(join(skillsDir, WORKFLOWS_DIR)).map(({ file, text }) => {
    const { data, body } = parseFrontmatter(text)
    const id = requireString(data.id, 'id', file)
    if (!ID_RE.test(id)) throw new Error(`${file}: \`id\` must be lowercase words joined by single hyphens`)
    if (id !== file.replace(/\.md$/, '')) throw new Error(`${file}: \`id\` must match the filename`)
    return {
      id,
      title: requireString(data.title, 'title', file),
      summary: requireString(data.summary, 'summary', file),
      argumentHint: typeof data['argument-hint'] === 'string' ? data['argument-hint'] : '',
      allowedTools: typeof data['allowed-tools'] === 'string' ? data['allowed-tools'] : '',
      body: body.replace(/^\r?\n/, ''),
    }
  })
}

export function loadAgents(skillsDir: string): AgentDef[] {
  return listSources(join(skillsDir, AGENTS_DIR)).map(({ file, text }) => {
    const { data, body } = parseFrontmatter(text)
    const id = requireString(data.id, 'id', file)
    if (id !== file.replace(/\.md$/, '')) throw new Error(`${file}: \`id\` must match the filename`)
    return {
      id,
      description: requireString(data.description, 'description', file),
      tools: requireString(data.tools, 'tools', file),
      model: requireString(data.model, 'model', file),
      body: body.replace(/^\r?\n/, ''),
    }
  })
}

/**
 * The skill's own `allowed-tools`, extended with every grant a workflow
 * declares that the skill does not already make.
 *
 * A workflow body lives inside the skill directory, so the skill's grant is
 * the one in force when an agent reaches the procedure by name rather than
 * through a command, and it is the grant the output validator holds every
 * command in the body against. Deriving it here keeps the two from drifting:
 * a workflow cannot ship a command its own skill would refuse, and the grant
 * is written once, in the workflow's frontmatter. Entries keep their order;
 * duplicates are dropped.
 */
export function mergeAllowedTools(base: string, workflows: readonly Pick<Workflow, 'allowedTools'>[]): string {
  const entries: string[] = []
  for (const list of [base, ...workflows.map(w => w.allowedTools)]) {
    for (const raw of list.split(',')) {
      const entry = raw.trim()
      if (entry !== '' && !entries.includes(entry)) entries.push(entry)
    }
  }
  return entries.join(', ')
}

function listSources(dir: string): Array<{ file: string; text: string }> {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => entry.name)
    .sort()
    .map(file => ({ file, text: readFileSync(join(dir, file), 'utf-8') }))
}

function requireString(value: unknown, key: string, file: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${file}: \`${key}\` is required and must be a single-line value`)
  }
  return value
}
