import { parseArgs } from 'node:util'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { detectProject, type ProjectDetection } from './detect.js'
import {
  plan,
  writePlannedFiles,
  relativePath,
  normalizePlatform,
  normalizePack,
  withRequiredPacks,
  PLATFORMS,
  PACKS,
  type PlannedFile,
  type ProjectInfo,
  type Platform,
  type Pack,
} from './generator.js'
import { detectLegacyOutputs, removeLegacyOutputs, type LegacyItem } from './migrate.js'
import { buildInstallCommands, formatCommand, runInstall, type InstallPlan } from './playwright-skills.js'
import { getVersion } from './version.js'

export const EXIT_OK = 0
export const EXIT_ERROR = 1
export const EXIT_CANCELLED = 130

export class CliUsageError extends Error {}

export interface CliFlags {
  command: string
  platforms?: Platform[]
  packs?: Pack[]
  projectName?: string
  baseUrl?: string
  fixtureImportPath?: string
  pageObjectsDir?: string
  testDir?: string
  yes: boolean
  nonInteractive: boolean
  dryRun: boolean
  force: boolean
  cleanLegacy: boolean
  installPlaywrightSkills: boolean
  help: boolean
  version: boolean
}

export const DEFAULT_PROJECT_INFO: ProjectInfo = {
  projectName: 'my-e2e-suite',
  baseUrl: 'https://staging.example.com',
  fixtureImportPath: '',
  pageObjectsDir: 'src/pages',
  testDir: 'src/tests',
}

const PLATFORM_OPTIONS: Array<{ value: Platform; label: string; hint: string }> = [
  { value: 'claude', label: 'Claude Code', hint: '.claude/skills/playwright-e2e/' },
  { value: 'cursor', label: 'Cursor', hint: '.agents/skills/ + .cursor/rules/playwright-e2e.mdc' },
  { value: 'copilot', label: 'GitHub Copilot', hint: '.agents/skills/ + .github/instructions/ + copilot-instructions.md' },
  { value: 'agents', label: 'Other agents (Codex, Gemini CLI, ...)', hint: '.agents/skills/playwright-e2e/' },
]

const OPTIONAL_PACK_OPTIONS: Array<{ value: Pack; label: string; hint: string }> = [
  { value: 'templates', label: 'Project templates', hint: 'conventions, page objects, debugging, generation, planning (customised with your project info)' },
  { value: 'playwright-cli', label: 'Official Playwright agent skills', hint: 'playwright-cli + playwright-trace via Playwright\'s own installer' },
]

export const HELP = `
${pc.bold(pc.cyan('wico'))} — Playwright Agent Skills

Usage:
  wico-playwright-agent-skills [init] [flags]
  wico-playwright-agent-skills help

Commands:
  init                          Scaffold agent skills into the current project (default)
  help                          Show this help

Selection flags (skip the matching prompt):
  --platforms <list>            Comma-separated: ${PLATFORMS.join(', ')} (generic = agents)
  --packs <list>                Comma-separated: ${PACKS.join(', ')} (core is always included)
  --project-name <name>         Project name used in the generated skill (default: package.json name)
  --base-url <url>              Application base URL for the templates
  --fixture-import-path <path>  Custom fixture import path, or "none" for @playwright/test
  --page-objects-dir <dir>      Page objects directory (default: src/pages)
  --test-dir <dir>              Test directory (default: src/tests)

Behaviour flags:
  -y, --yes                     Never prompt; use flags and defaults (implies --non-interactive)
      --non-interactive         Same as --yes (also automatic on CI or without a TTY)
      --dry-run                 Show what would be written and exit
  -f, --force                   Update existing files without asking
      --clean-legacy            Remove output left behind by 1.x without asking
      --install-playwright-skills
                                Run Playwright's own skill installer instead of printing the commands
  -h, --help                    Show this help
  -v, --version                 Show version

Examples:
  npx wico-playwright-agent-skills init
  npx wico-playwright-agent-skills init --platforms claude,cursor --yes
  npx wico-playwright-agent-skills init --platforms claude --packs core,templates \\
      --project-name shop-e2e --base-url https://staging.shop.example --yes --force
  npx wico-playwright-agent-skills init --platforms copilot --dry-run
`

export function parseFlags(argv: readonly string[]): CliFlags {
  let parsed: ReturnType<typeof parseArgs<typeof PARSE_ARGS_CONFIG>>
  try {
    parsed = parseArgs({ ...PARSE_ARGS_CONFIG, args: [...argv] })
  } catch (err) {
    throw new CliUsageError(err instanceof Error ? err.message : String(err))
  }
  const { values, positionals } = parsed

  if (positionals.length > 1) {
    throw new CliUsageError(`Unexpected arguments: ${positionals.slice(1).join(' ')}`)
  }

  const baseUrl = values['base-url']
  if (baseUrl !== undefined) {
    const problem = validateBaseUrl(baseUrl)
    if (problem) throw new CliUsageError(`--base-url: ${problem}`)
  }

  return {
    command: positionals[0] ?? 'init',
    platforms: values.platforms === undefined ? undefined : parseList('--platforms', values.platforms, normalizePlatform, PLATFORMS),
    packs: values.packs === undefined ? undefined : parseList('--packs', values.packs, normalizePack, PACKS),
    projectName: values['project-name'],
    baseUrl,
    fixtureImportPath: values['fixture-import-path'],
    pageObjectsDir: values['page-objects-dir'],
    testDir: values['test-dir'],
    yes: values.yes,
    nonInteractive: values['non-interactive'] || values.yes,
    dryRun: values['dry-run'],
    force: values.force,
    cleanLegacy: values['clean-legacy'],
    installPlaywrightSkills: values['install-playwright-skills'],
    help: values.help,
    version: values.version,
  }
}

const PARSE_ARGS_CONFIG = {
  allowPositionals: true,
  strict: true,
  options: {
    platforms: { type: 'string' },
    packs: { type: 'string' },
    'project-name': { type: 'string' },
    'base-url': { type: 'string' },
    'fixture-import-path': { type: 'string' },
    'page-objects-dir': { type: 'string' },
    'test-dir': { type: 'string' },
    yes: { type: 'boolean', short: 'y', default: false },
    'non-interactive': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    force: { type: 'boolean', short: 'f', default: false },
    'clean-legacy': { type: 'boolean', default: false },
    'install-playwright-skills': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
    version: { type: 'boolean', short: 'v', default: false },
  },
} as const

function parseList<T extends string>(flag: string, raw: string, normalize: (id: string) => T, allowed: readonly string[]): T[] {
  const ids = raw.split(',').map(part => part.trim()).filter(Boolean)
  if (ids.length === 0) throw new CliUsageError(`${flag} expects a comma-separated list (one of: ${allowed.join(', ')})`)
  const out: T[] = []
  for (const id of ids) {
    let normalized: T
    try {
      normalized = normalize(id)
    } catch {
      throw new CliUsageError(`${flag}: unknown value "${id}" (expected one of: ${allowed.join(', ')})`)
    }
    if (!out.includes(normalized)) out.push(normalized)
  }
  return out
}

export function validateBaseUrl(value: string): string | undefined {
  if (value.trim() === '') return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'must start with http:// or https://'
  } catch {
    return 'enter a valid URL (e.g. https://staging.example.com)'
  }
  return undefined
}

export interface Environment {
  isCI: boolean
  stdinIsTTY: boolean
  stdoutIsTTY: boolean
}

export function currentEnvironment(): Environment {
  return { isCI: p.isCI(), stdinIsTTY: Boolean(process.stdin.isTTY), stdoutIsTTY: p.isTTY(process.stdout) }
}

/** Prompts are only shown when nobody asked us not to and a human can answer them. */
export function isInteractive(flags: Pick<CliFlags, 'yes' | 'nonInteractive'>, env: Environment = currentEnvironment()): boolean {
  return !flags.yes && !flags.nonInteractive && !env.isCI && env.stdinIsTTY && env.stdoutIsTTY
}

export interface CliOptions {
  cwd?: string
  env?: Environment
}

/** Runs the CLI and returns the process exit code. */
export async function cli(argv: readonly string[], options: CliOptions = {}): Promise<number> {
  let flags: CliFlags
  try {
    flags = parseFlags(argv)
  } catch (err) {
    if (!(err instanceof CliUsageError)) throw err
    console.error(pc.red(`Error: ${err.message}`))
    console.error(HELP)
    return EXIT_ERROR
  }

  if (flags.version) {
    console.log(getVersion())
    return EXIT_OK
  }
  if (flags.help || flags.command === 'help') {
    console.log(HELP)
    return EXIT_OK
  }
  if (flags.command !== 'init') {
    console.error(pc.red(`Error: unknown command "${flags.command}"`))
    console.error(HELP)
    return EXIT_ERROR
  }

  return init(flags, options.cwd ?? process.cwd(), options.env ?? currentEnvironment())
}

async function init(flags: CliFlags, cwd: string, env: Environment): Promise<number> {
  const interactive = isInteractive(flags, env)
  let exitCode = EXIT_OK

  p.intro(`${pc.bold(pc.cyan('wico'))} — Playwright Agent Skills ${pc.dim(`v${getVersion()}`)}`)
  if (!interactive) p.log.info(pc.dim('Non-interactive mode: using flags and defaults, no prompts.'))

  // Step 1: detection
  p.log.step(`${pc.bold('Step 1:')} Project detection`)
  const detection = detectProject(cwd)
  reportDetection(detection)

  // Step 2: platforms
  p.log.step(`${pc.bold('Step 2:')} Agent platform(s)`)
  let platforms = flags.platforms
  if (!platforms) {
    if (!interactive) {
      p.log.error(`--platforms is required when running non-interactively (one or more of: ${PLATFORMS.join(', ')}).`)
      p.outro(pc.red('Nothing written.'))
      return EXIT_ERROR
    }
    const picked = await p.multiselect({ message: 'Which AI assistant(s) do you use?', options: PLATFORM_OPTIONS, required: true })
    if (p.isCancel(picked)) return cancelled()
    platforms = picked
  }
  p.log.info(`Platforms: ${platforms.join(', ')}`)

  // Step 3: packs
  p.log.step(`${pc.bold('Step 3:')} Skill packs`)
  let packs: Pack[]
  if (flags.packs) {
    packs = withRequiredPacks(flags.packs)
  } else if (interactive) {
    const picked = await p.multiselect({
      message: 'Optional skill packs (core patterns are always installed):',
      options: OPTIONAL_PACK_OPTIONS,
      initialValues: OPTIONAL_PACK_OPTIONS.map(option => option.value),
      required: false,
    })
    if (p.isCancel(picked)) return cancelled()
    packs = withRequiredPacks(picked)
  } else {
    packs = [...PACKS]
  }
  p.log.info(`Packs: ${packs.join(', ')}`)

  // Step 4: project info
  p.log.step(`${pc.bold('Step 4:')} Project info`)
  const projectInfo = await collectProjectInfo(flags, detection, packs.includes('templates'), interactive)
  if (projectInfo === null) return cancelled()

  // Step 5: plan
  p.log.step(`${pc.bold('Step 5:')} Plan`)
  let planned: PlannedFile[]
  try {
    planned = plan({ platforms, packs, projectInfo, cwd, meetsMinPlaywrightVersion: detection.meetsMinVersion })
  } catch (err) {
    p.log.error(err instanceof Error ? err.message : String(err))
    p.outro(pc.red('Nothing written.'))
    return EXIT_ERROR
  }
  const counts = countStatuses(planned)
  printPlan(planned, cwd)
  p.log.message(`${pc.green(`${counts.new} new`)}, ${pc.yellow(`${counts.modified} to update`)}, ${pc.dim(`${counts.unchanged} unchanged`)}`)

  const legacy = detectLegacyOutputs(cwd, planned)
  const install = packs.includes('playwright-cli') ? buildInstallCommands(detection, platforms) : null

  if (flags.dryRun) {
    if (legacy.length > 0) printLegacy(legacy, cwd, 'Would offer to remove legacy output:')
    if (install) printInstallPlan(install, 'Would print (or run with --install-playwright-skills):')
    p.outro('Dry run — nothing written.')
    return EXIT_OK
  }

  // Overwrite protection + single confirmation. Merged files keep hand-written
  // content and only swap our marker block, so they never need --force.
  const overwrites = planned.filter(file => file.status === 'modified' && file.mode === 'replace')
  if (overwrites.length > 0 && !flags.force) {
    p.log.warn(`${overwrites.length} existing file(s) differ from the generated content and would be ${pc.bold('overwritten')}:`)
    listPaths(overwrites.map(file => file.path), cwd)
    if (!interactive) {
      p.log.error('Re-run with --force to update them.')
      p.outro(pc.red('Nothing written.'))
      return EXIT_ERROR
    }
  }
  if (interactive) {
    const proceed = await p.confirm({
      message: `Write ${counts.new} new, update ${counts.modified}, skip ${counts.unchanged} unchanged. Proceed?`,
      initialValue: overwrites.length === 0 || flags.force,
    })
    if (p.isCancel(proceed)) return cancelled()
    if (!proceed) {
      p.cancel('Nothing written.')
      return EXIT_ERROR
    }
  }

  // Write
  if (counts.new + counts.modified === 0) {
    p.log.success('Already up to date — nothing to write.')
  } else {
    let written: string[]
    try {
      written = writePlannedFiles(planned)
    } catch (err) {
      p.log.error(err instanceof Error ? err.message : String(err))
      p.outro(pc.red('Generation failed.'))
      return EXIT_ERROR
    }
    p.log.success(`Wrote ${written.length} file(s)`)
    listPaths(written, cwd)
  }

  // Step 6: legacy output
  if (legacy.length > 0) {
    p.log.step(`${pc.bold('Step 6:')} Legacy output from 1.x`)
    printLegacy(legacy, cwd, 'Found output the current version no longer generates:')
    let remove = flags.cleanLegacy
    if (!remove && interactive) {
      const answer = await p.confirm({ message: `Remove these ${legacy.length} item(s)?`, initialValue: false })
      if (p.isCancel(answer)) return cancelled()
      remove = answer
    }
    if (remove) {
      const removed = removeLegacyOutputs(legacy)
      p.log.success(`Removed ${removed.length} item(s)`)
    } else if (!interactive) {
      p.log.info('Re-run with --clean-legacy to remove them.')
    }
  }

  // Step 7: official Playwright skills
  if (install) {
    p.log.step(`${pc.bold('Step 7:')} Official Playwright agent skills`)
    printInstallPlan(install, install.runnable ? 'Install commands:' : 'The official skills could not be installed automatically:')
    if (install.runnable) {
      let run = flags.installPlaywrightSkills
      if (!run && interactive) {
        const answer = await p.confirm({ message: 'Run these commands now?', initialValue: false })
        if (p.isCancel(answer)) return cancelled()
        run = answer
      }
      if (run) {
        for (const command of install.commands) {
          p.log.message(pc.dim(`$ ${formatCommand(command)}`))
          const result = runInstall(command, cwd)
          if (result.ok) {
            p.log.success(command.label)
          } else if (command.optional) {
            p.log.warn(`${command.label} — skipped (${result.error ?? `exit code ${result.status}`}); not available in this Playwright version`)
          } else {
            p.log.error(`${command.label} — failed (${result.error ?? `exit code ${result.status}`})`)
            exitCode = EXIT_ERROR
          }
        }
      } else if (!interactive) {
        p.log.info('Re-run with --install-playwright-skills to run them automatically.')
      }
    }
  }

  p.outro(exitCode === EXIT_OK
    ? `Done! Next: fill in the ${pc.cyan('<!-- YOUR PROJECT: ... -->')} markers in the generated references.`
    : pc.yellow('Finished with errors (see above).'))
  return exitCode
}

function cancelled(): number {
  p.cancel('Setup cancelled — nothing written.')
  return EXIT_CANCELLED
}

function reportDetection(detection: ProjectDetection): void {
  if (detection.playwrightConfig) {
    p.log.success(`Found ${detection.playwrightConfig}`)
  } else {
    p.log.warn('No playwright.config.* found — generating a generic setup')
  }
  p.log.info(detection.isTypeScript ? 'TypeScript project' : 'JavaScript project (TypeScript recommended)')

  const pw = detection.playwright
  if (!pw) {
    p.log.warn(`Playwright not detected — generating ${pc.bold('classic skills')} (install @playwright/test >= 1.59 for agent debugging)`)
    return
  }
  const origin = pw.source === 'range' ? pc.dim(` (from package.json; not installed)`) : ''
  if (detection.meetsMinVersion) {
    p.log.success(`${pw.name} ${pw.version}${origin} — ${pc.green('agent debugging enabled')} (--debug=cli, playwright-cli attach, npx playwright trace)`)
  } else {
    p.log.warn(`${pw.name} ${pw.version}${origin} — generating ${pc.bold('classic skills')} (upgrade to >= 1.59 for agent debugging)`)
  }
  if (detection.playwrightCli) {
    p.log.info(`${detection.playwrightCli.name} ${detection.playwrightCli.version} detected`)
  }
}

async function collectProjectInfo(flags: CliFlags, detection: ProjectDetection, needsTemplateInfo: boolean, interactive: boolean): Promise<ProjectInfo | null> {
  const defaults: ProjectInfo = { ...DEFAULT_PROJECT_INFO, projectName: detection.packageName ?? DEFAULT_PROJECT_INFO.projectName }

  const projectName = await resolveText(flags.projectName, defaults.projectName, interactive, { message: 'Project name:' })
  if (projectName === null) return null

  if (!needsTemplateInfo) {
    p.log.info(`Project: ${projectName}`)
    return { ...defaults, projectName }
  }

  const baseUrl = await resolveText(flags.baseUrl, defaults.baseUrl, interactive, {
    message: 'Base URL:',
    validate: value => validateBaseUrl(value ?? ''),
  })
  if (baseUrl === null) return null

  const fixtureImportPath = await resolveText(flags.fixtureImportPath, defaults.fixtureImportPath, interactive, {
    message: 'Fixture import path (or "none" for @playwright/test):',
    placeholder: '../fixtures/test-fixture',
  })
  if (fixtureImportPath === null) return null

  const pageObjectsDir = await resolveText(flags.pageObjectsDir, defaults.pageObjectsDir, interactive, { message: 'Page objects directory:' })
  if (pageObjectsDir === null) return null

  const testDir = await resolveText(flags.testDir, defaults.testDir, interactive, { message: 'Test directory:' })
  if (testDir === null) return null

  const info = { projectName, baseUrl, fixtureImportPath, pageObjectsDir, testDir }
  p.log.info(`Project: ${info.projectName}, base URL ${info.baseUrl}, fixtures ${info.fixtureImportPath || 'none'}, pages ${info.pageObjectsDir}, tests ${info.testDir}`)
  return info
}

interface TextPrompt {
  message: string
  placeholder?: string
  validate?: (value: string | undefined) => string | undefined
}

/** Flag value → prompt (interactive) → default. `null` means the user cancelled. */
async function resolveText(flagValue: string | undefined, fallback: string, interactive: boolean, prompt: TextPrompt): Promise<string | null> {
  if (flagValue !== undefined) return flagValue
  if (!interactive) return fallback
  const answer = await p.text({
    message: prompt.message,
    placeholder: prompt.placeholder ?? fallback,
    defaultValue: fallback,
    initialValue: prompt.placeholder ? undefined : fallback,
    validate: prompt.validate,
  })
  if (p.isCancel(answer)) return null
  return answer
}

function countStatuses(planned: readonly PlannedFile[]): Record<PlannedFile['status'], number> {
  const counts = { new: 0, modified: 0, unchanged: 0 }
  for (const file of planned) counts[file.status]++
  return counts
}

function printPlan(planned: readonly PlannedFile[], cwd: string): void {
  const marker: Record<PlannedFile['status'], string> = {
    new: pc.green('+'),
    modified: pc.yellow('~'),
    unchanged: pc.dim('='),
  }
  const lines = planned.map(file => {
    const line = `${marker[file.status]} ${relativePath(cwd, file.path)}${file.mode === 'merge' ? pc.dim(' (merged block)') : ''}`
    return file.status === 'unchanged' ? pc.dim(line) : line
  })
  p.log.message(lines.join('\n'))
}

function listPaths(paths: readonly string[], cwd: string, limit = 15): void {
  const lines = paths.slice(0, limit).map(path => `  ${relativePath(cwd, path)}`)
  if (paths.length > limit) lines.push(`  ...and ${paths.length - limit} more`)
  p.log.message(pc.dim(lines.join('\n')))
}

function printLegacy(items: readonly LegacyItem[], cwd: string, title: string): void {
  p.log.warn(title)
  p.log.message(items.map(item => `  ${relativePath(cwd, item.path)}${item.kind === 'dir' ? '/' : ''} ${pc.dim(`— ${item.reason}`)}`).join('\n'))
}

function printInstallPlan(install: InstallPlan, title: string): void {
  p.log.info(title)
  const lines = install.commands.map(command => `  ${pc.cyan(formatCommand(command))} ${pc.dim(`— ${command.label}`)}`)
  lines.push(...install.notes.map(note => pc.dim(`  ${note}`)))
  p.log.message(lines.join('\n'))
}
