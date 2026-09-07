/**
 * Minimal YAML-frontmatter helper for SKILL.md-style files.
 *
 * Supports the flat `key: value` shape used by the Agent Skills spec plus one
 * level of nested maps (e.g. `metadata:`), which is all we generate or read.
 * Deliberately not a YAML parser: unknown constructs are kept verbatim.
 */

export type FrontmatterValue = string | Record<string, string>
export type FrontmatterData = Record<string, FrontmatterValue>

export interface ParsedFrontmatter {
  data: FrontmatterData
  body: string
  hasFrontmatter: boolean
}

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

export function parseFrontmatter(text: string): ParsedFrontmatter {
  const match = FRONTMATTER_RE.exec(text)
  if (!match) return { data: {}, body: text, hasFrontmatter: false }

  const data: FrontmatterData = {}
  let currentMap: { key: string; value: Record<string, string> } | null = null

  for (const rawLine of match[1].split(/\r?\n/)) {
    if (rawLine.trim() === '' || rawLine.trim().startsWith('#')) continue

    const nested = /^[ \t]+([\w.-]+):[ \t]*(.*)$/.exec(rawLine)
    if (nested && currentMap) {
      currentMap.value[nested[1]] = parseScalar(nested[2])
      continue
    }

    const top = /^([\w.-]+):[ \t]*(.*)$/.exec(rawLine)
    if (!top) continue

    const [, key, value] = top
    if (value === '') {
      currentMap = { key, value: {} }
      data[key] = currentMap.value
    } else {
      currentMap = null
      data[key] = parseScalar(value)
    }
  }

  return { data, body: text.slice(match[0].length), hasFrontmatter: true }
}

export function serializeFrontmatter(data: FrontmatterData): string {
  const lines: string[] = ['---']
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      lines.push(`${key}: ${formatScalar(value)}`)
    } else {
      lines.push(`${key}:`)
      for (const [subKey, subValue] of Object.entries(value)) {
        lines.push(`  ${subKey}: ${formatScalar(subValue)}`)
      }
    }
  }
  lines.push('---')
  return lines.join('\n') + '\n'
}

/**
 * Prepends frontmatter to `text`. If `text` already has frontmatter, the two
 * are merged with `data` taking precedence, so a template can ship its own
 * `name`/`description` and the generator can add `metadata` on top.
 */
export function withFrontmatter(text: string, data: FrontmatterData): string {
  const parsed = parseFrontmatter(text)
  const merged: FrontmatterData = { ...parsed.data }
  for (const [key, value] of Object.entries(data)) {
    const existing = merged[key]
    merged[key] = typeof value === 'object' && typeof existing === 'object'
      ? { ...existing, ...value }
      : value
  }
  const body = parsed.body.replace(/^\r?\n/, '')
  return `${serializeFrontmatter(merged)}\n${body}`
}

function parseScalar(raw: string): string {
  const value = raw.trim()
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    try {
      return JSON.parse(value)
    } catch {
      return value.slice(1, -1)
    }
  }
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replace(/''/g, "'")
  }
  return value
}

const PLAIN_SCALAR_RE = /^[A-Za-z0-9_][A-Za-z0-9_ .,()/+@=-]*$/

function formatScalar(value: string): string {
  if (
    PLAIN_SCALAR_RE.test(value) &&
    !value.includes(': ') &&
    !value.includes(' #') &&
    value.trim() === value
  ) {
    return value
  }
  return JSON.stringify(value)
}
