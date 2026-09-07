export interface TemplateContext {
  PROJECT_NAME: string
  BASE_URL: string
  FIXTURE_IMPORT_PATH: string
  PAGE_OBJECTS_DIR: string
  TEST_DIR: string
  HAS_CUSTOM_FIXTURE: boolean
  HAS_PLAYWRIGHT_159: boolean
  HAS_CORE: boolean
  HAS_TEMPLATES: boolean
  HAS_PLAYWRIGHT_CLI: boolean
}

export const ALL_PACKS = ['core', 'templates', 'playwright-cli'] as const
export type Pack = (typeof ALL_PACKS)[number]

/**
 * Small template engine for the skill markdown files.
 *
 *   {{KEY}}                          string substitution (unknown keys are left as-is)
 *   {{#if KEY}}...{{/if}}            conditional block
 *   {{#if KEY}}...{{else}}...{{/if}} conditional with fallback
 *
 * Blocks may nest. A tag that sits on its own line is removed together with
 * its line, so block-level conditionals leave no blank lines behind. Runs of
 * blank lines outside fenced code are collapsed to a single blank line.
 * Unknown condition keys throw, because silently dropping content hides typos.
 *
 * Preserves `<!-- YOUR PROJECT: ... -->` markers for human editing.
 */
export function renderTemplate(template: string, ctx: TemplateContext): string {
  let result = renderConditionals(template, ctx)

  result = result.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = ctx[key as keyof TemplateContext]
    return typeof value === 'string' ? value : match
  })

  return collapseBlankLines(result)
}

// Matches the innermost {{#if}} block (its body contains no other {{#if}}).
// Groups: 1 = key, 2 = newline right after the opening tag, 3 = body,
// 4 = newline right before the closing tag, 5 = newline right after it.
const IF_RE = /\{\{#if[ \t]+(\w+)\}\}([ \t]*\n)?((?:(?!\{\{#if[ \t])[\s\S])*?)(\n[ \t]*)?\{\{\/if\}\}([ \t]*\n)?/
const ELSE_RE = /(\n[ \t]*)?\{\{else\}\}([ \t]*\n)?/

function renderConditionals(template: string, ctx: TemplateContext): string {
  let result = template
  let match: RegExpExecArray | null
  while ((match = IF_RE.exec(result)) !== null) {
    const [whole, key, afterOpen, body, beforeClose, afterClose] = match
    if (!(key in ctx)) {
      throw new Error(`Unknown template condition: {{#if ${key}}}`)
    }
    const truthy = Boolean(ctx[key as keyof TemplateContext])

    // Does the opening tag start its line (allowing indentation)?
    let start = match.index
    while (start > 0 && (result[start - 1] === ' ' || result[start - 1] === '\t')) start--
    const atLineStart = start === 0 || result[start - 1] === '\n'
    const indent = atLineStart ? result.slice(start, match.index) : ''
    if (!atLineStart) start = match.index

    const elseMatch = ELSE_RE.exec(body)
    const thenBody = elseMatch ? body.slice(0, elseMatch.index) : body
    const elseBody = elseMatch ? body.slice(elseMatch.index + elseMatch[0].length) : null
    const chosen = truthy ? thenBody : elseBody

    // Block that owns whole lines: drop the tag lines entirely.
    const lineLevel = atLineStart && afterClose !== undefined
    let replacement: string
    if (lineLevel) {
      replacement = chosen === null || chosen === '' ? '' : `${chosen}${afterClose}`
    } else if (chosen === null) {
      replacement = `${indent}${afterClose ?? ''}`
    } else {
      replacement = `${indent}${afterOpen ?? ''}${chosen}${beforeClose ?? ''}${afterClose ?? ''}`
    }

    result = result.slice(0, start) + replacement + result.slice(match.index + whole.length)
  }
  return result
}

function collapseBlankLines(text: string): string {
  const out: string[] = []
  let inFence = false
  let blankRun = 0
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      blankRun = 0
      out.push(line)
      continue
    }
    if (!inFence && line.trim() === '') {
      blankRun++
      if (blankRun > 1) continue
      out.push(line)
      continue
    }
    blankRun = 0
    out.push(line)
  }
  return out.join('\n')
}

export interface ContextOptions {
  meetsMinPlaywrightVersion?: boolean
  packs?: readonly string[]
}

export function buildContext(projectInfo: {
  projectName: string
  baseUrl: string
  fixtureImportPath: string
  pageObjectsDir: string
  testDir: string
}, options: ContextOptions = {}): TemplateContext {
  const fixtureImportPath = projectInfo.fixtureImportPath.trim()
  const hasCustomFixture = fixtureImportPath !== '' && fixtureImportPath.toLowerCase() !== 'none'
  const packs = options.packs ?? ALL_PACKS

  return {
    PROJECT_NAME: projectInfo.projectName,
    BASE_URL: projectInfo.baseUrl,
    FIXTURE_IMPORT_PATH: hasCustomFixture ? fixtureImportPath : '',
    PAGE_OBJECTS_DIR: projectInfo.pageObjectsDir,
    TEST_DIR: projectInfo.testDir,
    HAS_CUSTOM_FIXTURE: hasCustomFixture,
    HAS_PLAYWRIGHT_159: options.meetsMinPlaywrightVersion ?? false,
    HAS_CORE: packs.includes('core'),
    HAS_TEMPLATES: packs.includes('templates'),
    HAS_PLAYWRIGHT_CLI: packs.includes('playwright-cli'),
  }
}

// Our own template syntax only: `{{#if X}}`, `{{else}}`, `{{/if}}` and `{{UPPER_SNAKE}}`.
// Deliberately does not match things like GitHub Actions' `${{ matrix.shard }}`.
const UNRENDERED_RE = /\{\{\s*(?:#if\b[^}]*|\/if|else|[A-Z][A-Z0-9_]*)\s*\}\}/

/** Returns the first piece of unrendered template syntax in `text`, or null. */
export function findUnrenderedTemplate(text: string): string | null {
  const match = UNRENDERED_RE.exec(text)
  return match ? match[0] : null
}
