#!/usr/bin/env node
/**
 * Type-checks every ```typescript / ```ts fence in skills/**\/*.md against the
 * real `@playwright/test` types, and prints `file:line` for each failure.
 *
 * A snippet that does not compile teaches the agent reading it an API that
 * does not exist, and the agent will reproduce it faithfully. The references
 * cannot run their examples, but they can at least make the compiler read them.
 *
 * How a fence is checked:
 *
 *   - The skill file is rendered with the template engine first, once per
 *     variant (Playwright >= 1.59 with a custom fixture file, and below 1.59
 *     with none), so `{{#if}}` branches inside a fence are each checked.
 *     Identical renders are checked once.
 *   - Each fence becomes its own module (`export {}` is appended when it has
 *     no import or export), so top-level `await` works and names never collide
 *     across fences.
 *   - A shared prelude puts in scope what a test body has, or what a snippet
 *     routinely leaves out: the `page`, `context`, `request`, `browser`,
 *     `browserName` and `testInfo` fixtures; `test`, `expect`, `defineConfig`,
 *     `devices` and the three browser types; `base` and `setup`, the aliases
 *     Playwright's own docs give `test`; and the common Playwright types
 *     (`Page`, `Locator`, ...). A fence that imports or declares one of these
 *     itself shadows the prelude; nothing conflicts.
 *   - `noImplicitAny` is off and everything else in `strict` is on.
 *   - An import the compiler cannot resolve — a relative path into the
 *     reader's project, or a package this repo does not install — is not an
 *     error; its bindings are `any`. `@playwright/test` and `node:*` must
 *     resolve. The unresolved specifiers are listed in the summary.
 *
 * Directives are HTML comments on the lines directly above a fence (they
 * render as nothing). At most one mode per fence:
 *
 *   <!-- ts-check: skip -->           not checked: an example that is wrong on
 *                                     purpose, or alternatives shown side by side
 *   <!-- ts-check: wrap-test -->      the fence is a test body: wrapped in
 *                                     `test('fence', async ({ page, context,
 *                                     request, browser }) => { ... })`
 *   <!-- ts-check: wrap-class -->     the fence is class members (fields, a
 *                                     constructor, methods): wrapped in a class
 *                                     whose index signature stands in for the
 *                                     members the excerpt does not show
 *   <!-- ts-check: wrap-config -->    the fence is properties of the Playwright
 *                                     config: wrapped in `defineConfig({ ... })`,
 *                                     so an option that does not exist fails
 *
 * and any number of
 *
 *   <!-- ts-check: declare a, B -->   names from the reader's project (a page
 *                                     object, a helper, a schema), declared as
 *                                     `any` both as a value and as a type; the
 *                                     rest of the fence is still checked
 *
 * Text after a mode is a free-form reason.
 *
 * Usage: tsx scripts/check-ts-fences.ts [--keep] [skills dir]
 *   --keep  leave the generated project in place and print its path
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { buildContext, renderTemplate, type TemplateContext } from '../src/template-engine.js'

/** How a fence is turned into a module. `check` is the default: the fence as written. */
export type Directive = 'check' | 'skip' | 'wrap-test' | 'wrap-class' | 'wrap-config'

const MODES = ['skip', 'wrap-test', 'wrap-class', 'wrap-config'] as const

export interface Fence {
  /** 1-based line of the opening ``` in the source file. */
  line: number
  directive: Directive
  /** Names `declare` directives put in scope as `any`. */
  declared: string[]
  /** Fence content, de-indented to the fence's own indentation. */
  code: string
}

const OPEN_RE = /^([ \t]*)(`{3,}|~{3,})[ \t]*(typescript|ts)[ \t]*$/
const ANY_OPEN_RE = /^([ \t]*)(`{3,}|~{3,})/
const DIRECTIVE_RE = /^[ \t]*<!--[ \t]*ts-check:[ \t]*([a-z-]+)\b(.*?)-->[ \t]*$/
const IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/

/**
 * Every TypeScript fence in `text`, in source order. Directive comments sit on
 * the lines immediately above the fence, one per line. An unknown directive,
 * two modes on one fence, or a directive that is not directly above a
 * TypeScript fence throws, so a typo or a stray blank line cannot silently
 * change what is checked.
 */
export function extractFences(text: string, file = '<text>'): Fence[] {
  const lines = text.split(/\r?\n/)
  const fences: Fence[] = []
  for (let i = 0; i < lines.length; i++) {
    const open = ANY_OPEN_RE.exec(lines[i])
    if (!open) {
      if (DIRECTIVE_RE.test(lines[i])) {
        // Directives are claimed by the fence below them; check once the run ends.
        let next = i
        while (next < lines.length && DIRECTIVE_RE.test(lines[next])) next++
        if (!(next < lines.length && OPEN_RE.test(lines[next]))) {
          throw new Error(`${file}:${i + 1}: ts-check directive is not directly above a TypeScript fence`)
        }
        i = next - 1
      }
      continue
    }
    const [, indent, marker] = open
    const isTs = OPEN_RE.test(lines[i])
    // Find the closing fence: same character, at least as long, nothing after it.
    let end = i + 1
    const closeRe = new RegExp(`^[ \\t]*${marker[0] === '`' ? '`' : '~'}{${marker.length},}[ \\t]*$`)
    while (end < lines.length && !closeRe.test(lines[end])) end++
    if (isTs) {
      const body = lines.slice(i + 1, end).map(line => (line.startsWith(indent) ? line.slice(indent.length) : line.trimStart()))
      fences.push({ line: i + 1, ...directiveAbove(lines, i, file), code: body.join('\n') })
    }
    i = end
  }
  return fences
}

function directiveAbove(lines: string[], fenceIndex: number, file: string): { directive: Directive; declared: string[] } {
  let directive: Directive = 'check'
  const declared: string[] = []
  for (let i = fenceIndex - 1; i >= 0; i--) {
    const match = DIRECTIVE_RE.exec(lines[i])
    if (!match) break
    const [, name, rest] = match
    const where = `${file}:${i + 1}`
    if (name === 'declare') {
      const names = rest.split(',').map(part => part.trim()).filter(part => part !== '')
      const bad = names.find(part => !IDENTIFIER_RE.test(part))
      if (names.length === 0 || bad !== undefined) {
        throw new Error(`${where}: \`ts-check: declare\` takes a comma-separated list of identifiers${bad ? ` (got "${bad}")` : ''}`)
      }
      declared.push(...names)
    } else if ((MODES as readonly string[]).includes(name)) {
      if (directive !== 'check') throw new Error(`${where}: a fence takes one of ${MODES.join(', ')}, not two`)
      directive = name as Directive
    } else {
      throw new Error(`${where}: unknown ts-check directive "${name}" (expected ${MODES.join(', ')} or declare)`)
    }
  }
  return { directive, declared }
}

/** Ambient declarations every fence sees; a fence's own imports shadow them. */
export const PRELUDE = `import type * as PW from '@playwright/test'

declare global {
  const test: typeof PW.test
  const expect: typeof PW.expect
  const base: typeof PW.test
  const setup: typeof PW.test
  const defineConfig: typeof PW.defineConfig
  const devices: typeof PW.devices
  const chromium: typeof PW.chromium
  const firefox: typeof PW.firefox
  const webkit: typeof PW.webkit
  const page: PW.Page
  const context: PW.BrowserContext
  const request: PW.APIRequestContext
  const browser: PW.Browser
  const browserName: 'chromium' | 'firefox' | 'webkit'
  const testInfo: PW.TestInfo
  type Page = PW.Page
  type Locator = PW.Locator
  type BrowserContext = PW.BrowserContext
  type Browser = PW.Browser
  type APIRequestContext = PW.APIRequestContext
  type APIResponse = PW.APIResponse
  type Request = PW.Request
  type Response = PW.Response
  type Route = PW.Route
  type TestInfo = PW.TestInfo
  type FrameLocator = PW.FrameLocator
}

export {}
`

const HAS_MODULE_SYNTAX_RE = /^[ \t]*(?:import|export)\b/m

/** The module written for one fence. Returns the source and how many lines precede the fence's first line. */
export function moduleFor(fence: Pick<Fence, 'code' | 'directive' | 'declared'>): { source: string; offset: number } {
  // A value and a type of the same name, so a declared name works as either.
  const header = fence.declared.map(name => `declare const ${name}: any; type ${name} = any\n`).join('')
  const indented = fence.code.split('\n').map(line => (line === '' ? line : `  ${line}`)).join('\n')
  const wrap = (open: string, close: string): { source: string; offset: number } => ({
    source: `${header}${open}\n${indented}\n${close}\n\nexport {}\n`,
    offset: fence.declared.length + open.split('\n').length,
  })
  switch (fence.directive) {
    case 'wrap-test':
      return wrap(`test('fence', async ({ page, context, request, browser }) => {`, '})')
    case 'wrap-class':
      // The index signature stands in for the members the excerpt does not show.
      return wrap('export class Fence {\n  [member: string]: any', '}')
    case 'wrap-config':
      return wrap('export const fence = defineConfig({', '})')
    default: {
      const tail = HAS_MODULE_SYNTAX_RE.test(fence.code) ? '\n' : '\n\nexport {}\n'
      return { source: `${header}${fence.code}${tail}`, offset: fence.declared.length }
    }
  }
}

/** Template variants worth checking separately; identical renders are deduplicated. */
const VARIANTS: Array<{ label: string; ctx: TemplateContext }> = [
  {
    label: 'pw>=1.59, custom fixture',
    ctx: buildContext(
      { projectName: 'fence-check', baseUrl: 'https://staging.example.com', fixtureImportPath: '../fixtures/test-fixture', pageObjectsDir: 'src/pages', testDir: 'src/tests' },
      { meetsMinPlaywrightVersion: true },
    ),
  },
  {
    label: 'pw<1.59, no fixture',
    ctx: buildContext(
      { projectName: 'fence-check', baseUrl: 'https://staging.example.com', fixtureImportPath: '', pageObjectsDir: 'src/pages', testDir: 'src/tests' },
      { meetsMinPlaywrightVersion: false },
    ),
  },
]

export interface CheckedFence {
  /** Source file, relative to the repo root, POSIX separators. */
  file: string
  /** 1-based line of the opening fence in the source file. */
  line: number
  directive: Directive
  declared: string[]
  /** Variant labels this exact rendering stands for. */
  variants: string[]
  code: string
}

export interface FenceFailure {
  file: string
  /** Line in the source file the diagnostic maps to (best effort for templated fences). */
  line: number
  fenceLine: number
  code: string
  message: string
  variants: string[]
}

/**
 * Every fence in every skill file, rendered once per template variant.
 *
 * Fences are taken from the unrendered source, so line numbers are the
 * source's. Template syntax inside a fence is rendered per variant, with the
 * fence markers kept around it so the engine treats its blank lines exactly
 * as it would in the file, and a variant whose rendered file does not contain
 * the fence (a `{{#if}}` wraps it whole) is not checked under it. A fence no
 * variant shows is checked under all of them rather than not at all.
 */
export function collectFences(skillsDir: string, repoRoot: string): CheckedFence[] {
  const out: CheckedFence[] = []
  for (const path of listMarkdown(skillsDir)) {
    const file = relative(repoRoot, path).split(sep).join('/')
    const raw = readFileSync(path, 'utf-8')
    // What each variant actually shows: a fence inside a false `{{#if}}` is not
    // in that variant's output, and is not checked under it.
    const shown = VARIANTS.map(variant => extractFences(renderTemplate(raw, variant.ctx), file).map(f => f.code))
    for (const fence of extractFences(raw, file)) {
      const byCode = new Map<string, CheckedFence>()
      const rendered = VARIANTS.map(variant => renderFence(fence.code, variant.ctx))
      const anyShown = rendered.some((code, v) => shown[v].includes(code))
      for (const [v, variant] of VARIANTS.entries()) {
        const code = rendered[v]
        if (anyShown && !shown[v].includes(code)) continue
        const existing = byCode.get(code)
        if (existing) {
          existing.variants.push(variant.label)
          continue
        }
        const entry: CheckedFence = { file, line: fence.line, directive: fence.directive, declared: fence.declared, variants: [variant.label], code }
        byCode.set(code, entry)
        out.push(entry)
      }
    }
  }
  return out
}

function renderFence(code: string, ctx: TemplateContext): string {
  const rendered = renderTemplate(`\`\`\`ts\n${code}\n\`\`\``, ctx)
  return rendered.replace(/^```ts\n/, '').replace(/\n```$/, '')
}

function listMarkdown(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => join(entry.parentPath, entry.name))
    .sort()
}

const DIAGNOSTIC_RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/
/** "Cannot find module" in its several phrasings. */
const UNRESOLVED_CODES = new Set(['TS2307', 'TS2792'])
const MUST_RESOLVE_RE = /^(?:@playwright\/test|node:)/

export interface CheckResult {
  fences: CheckedFence[]
  checked: CheckedFence[]
  skipped: CheckedFence[]
  failures: FenceFailure[]
  /** Specifiers that did not resolve and were typed as `any`. */
  unresolved: string[]
  /** The tsc invocation failed for a reason other than type errors. */
  toolError: string | null
  workDir: string
}

export function checkFences(options: { repoRoot: string; skillsDir: string; keep?: boolean }): CheckResult {
  const { repoRoot, skillsDir } = options
  const fences = collectFences(skillsDir, repoRoot)
  const checked = fences.filter(f => f.directive !== 'skip')
  const skipped = fences.filter(f => f.directive === 'skip')

  const workDir = mkdtempSync(join(tmpdir(), 'wico-ts-fences-'))
  const failures: FenceFailure[] = []
  const unresolved = new Set<string>()
  let toolError: string | null = null
  try {
    // Resolve @playwright/test and @types/node from this repo's own install.
    symlinkSync(join(repoRoot, 'node_modules'), join(workDir, 'node_modules'), 'junction')
    writeFileSync(join(workDir, 'prelude.d.ts'), PRELUDE)
    mkdirSync(join(workDir, 'fences'))

    const byModule = new Map<string, { fence: CheckedFence; offset: number }>()
    checked.forEach((fence, index) => {
      const name = `f${String(index).padStart(3, '0')}.ts`
      const { source, offset } = moduleFor(fence)
      writeFileSync(join(workDir, 'fences', name), source)
      byModule.set(`fences/${name}`, { fence, offset })
    })

    // tsc reports no semantic diagnostic at all while any file has a syntax
    // error, so a fence that does not parse is recorded and dropped, and the
    // rest are compiled again. A fence's syntax errors cascade; only the
    // first one is kept.
    let remaining = [...byModule.keys()]
    for (let pass = 0; pass < 3 && remaining.length > 0 && toolError === null; pass++) {
      writeFileSync(join(workDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          // A binding from an unresolved project import is \`any\`, and every
          // parameter of a callback passed to it would otherwise be an error
          // about the snippet's context rather than about Playwright's API.
          noImplicitAny: false,
          noEmit: true,
          skipLibCheck: true,
          esModuleInterop: true,
          types: ['node'],
        },
        files: ['prelude.d.ts', ...remaining],
      }, null, 2))

      const tsc = spawnSync(process.execPath, [tscBin(repoRoot), '-p', 'tsconfig.json', '--pretty', 'false'], { cwd: workDir, encoding: 'utf-8' })
      if (tsc.error) {
        toolError = String(tsc.error)
        break
      }
      const output = `${tsc.stdout}${tsc.stderr}`
      const unparsed = new Set<string>()
      let parsed = 0
      for (const { raw, head, detail } of groupDiagnostics(output)) {
        const match = DIAGNOSTIC_RE.exec(head)
        if (!match) continue
        parsed++
        const [, path, lineText, , code, first] = match
        const message = detail === '' ? first : `${first} ${detail}`
        const key = path.split(sep).join('/').replace(/^\.\//, '')
        const target = byModule.get(key)
        if (!target) {
          toolError = `${toolError ?? ''}${raw}\n`
          continue
        }
        const syntax = /^TS1\d{3}$/.test(code)
        if (syntax && unparsed.has(key)) continue
        if (syntax) unparsed.add(key)
        if (UNRESOLVED_CODES.has(code)) {
          const quoted = /'([^']*)'|"([^"]*)"/.exec(message)
          const spec = quoted ? (quoted[1] ?? quoted[2]) : '?'
          if (!MUST_RESOLVE_RE.test(spec)) {
            unresolved.add(spec === '' ? "''" : spec)
            continue
          }
        }
        const { fence, offset } = target
        failures.push({
          file: fence.file,
          line: sourceLine(repoRoot, fence, Number(lineText) - offset),
          fenceLine: fence.line,
          code,
          message: syntax ? `${message} (does not parse; later errors in this fence not reported)` : message,
          variants: fence.variants,
        })
      }
      if (tsc.status !== 0 && parsed === 0) toolError = output.trim() || `tsc exited with status ${tsc.status}`
      if (unparsed.size === 0) break
      remaining = remaining.filter(key => !unparsed.has(key))
    }
  } finally {
    if (!options.keep) rmSync(workDir, { recursive: true, force: true })
  }
  return { fences, checked, skipped, failures, unresolved: [...unresolved].sort(), toolError, workDir }
}

/**
 * tsc prints a diagnostic's elaboration ("No overload matches this call",
 * then why) on indented lines after the first. Each diagnostic is returned
 * with that elaboration folded onto one line and capped.
 */
function groupDiagnostics(output: string): Array<{ raw: string; head: string; detail: string }> {
  const groups: Array<{ raw: string; head: string; details: string[] }> = []
  for (const line of output.split(/\r?\n/)) {
    if (/^\s/.test(line) && groups.length > 0 && line.trim() !== '') {
      groups[groups.length - 1].details.push(line.trim())
    } else if (line.trim() !== '') {
      groups.push({ raw: line, head: line.trim(), details: [] })
    }
  }
  return groups.map(({ raw, head, details }) => {
    const detail = details.join(' ')
    return { raw, head, detail: detail.length > 400 ? `${detail.slice(0, 400)}...` : detail }
  })
}

/**
 * Maps a line inside a rendered fence back to the source file. Without
 * template syntax in the fence the mapping is exact; with it, the rendered
 * line is looked up by its text among the source fence's lines.
 */
function sourceLine(repoRoot: string, fence: CheckedFence, lineInFence: number): number {
  const lines = fence.code.split('\n')
  if (lineInFence < 1 || lineInFence > lines.length) return fence.line
  const raw = readFileSync(join(repoRoot, fence.file), 'utf-8').split(/\r?\n/)
  const exact = fence.line + lineInFence
  const wanted = lines[lineInFence - 1].trim()
  if (raw[exact - 1]?.trim() === wanted) return exact
  for (let i = fence.line; i < raw.length && !/^[ \t]*(`{3,}|~{3,})[ \t]*$/.test(raw[i]); i++) {
    if (raw[i].trim() === wanted) return i + 1
  }
  return fence.line
}

function tscBin(repoRoot: string): string {
  const require = createRequire(join(repoRoot, 'package.json'))
  const pkgPath = require.resolve('typescript/package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { bin?: Record<string, string> | string }
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.tsc
  if (!bin) throw new Error('typescript does not declare a tsc binary')
  return join(dirname(pkgPath), bin)
}

function main(): void {
  const args = process.argv.slice(2)
  const keep = args.includes('--keep')
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const skillsDir = resolve(args.find(arg => !arg.startsWith('--')) ?? join(repoRoot, 'skills'))
  if (!existsSync(join(repoRoot, 'node_modules', '@playwright', 'test'))) {
    console.error('@playwright/test is not installed; run npm ci first')
    process.exit(2)
  }

  const result = checkFences({ repoRoot, skillsDir, keep })
  if (result.toolError) {
    console.error(`tsc did not produce a usable result:\n${result.toolError}`)
    process.exit(2)
  }

  for (const failure of result.failures) {
    const variant = failure.variants.length === VARIANTS.length ? '' : ` [${failure.variants.join('; ')}]`
    console.error(`${failure.file}:${failure.line}: ${failure.code} ${failure.message}${variant}`)
  }

  const failedFences = new Set(result.failures.map(f => `${f.file}:${f.fenceLine}`))
  const sourceFences = new Set(result.fences.map(f => `${f.file}:${f.line}`))
  const skippedFences = new Set(result.skipped.map(f => `${f.file}:${f.line}`))
  console.log(
    `${sourceFences.size} TypeScript fences (${result.checked.length} renderings checked, ${skippedFences.size} skipped by directive): ` +
      `${failedFences.size} failing, ${result.failures.length} diagnostics`,
  )
  if (result.unresolved.length > 0) console.log(`Unresolved imports typed as any: ${result.unresolved.join(', ')}`)
  if (keep) console.log(`Generated project kept at ${result.workDir}`)
  process.exit(result.failures.length === 0 ? 0 : 1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
