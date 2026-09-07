import { spawnSync } from 'node:child_process'
import type { Platform } from './generator.js'
import type { ProjectDetection } from './detect.js'

/**
 * Playwright ships and installs its own agent skills (`playwright-cli`,
 * `playwright-trace`). The `playwright-cli` pack therefore writes no files of
 * its own: it works out the right official install commands for the selected
 * platforms and either prints them or runs them. Nothing here ever writes into
 * a `skills/playwright-cli/` directory directly; only Playwright's installer does.
 */

export interface InstallCommand {
  /** argv, e.g. `['npx', 'playwright', 'cli', 'install', '--skills']`. */
  argv: string[]
  /** What the command installs and where. */
  label: string
  /** Failure is reported but does not fail the run (feature may not exist in the local version). */
  optional?: boolean
}

export interface InstallPlan {
  commands: InstallCommand[]
  /** Guidance printed alongside the commands (e.g. how to obtain a CLI when none is installed). */
  notes: string[]
  /** `true` when `commands` can be executed against the local install as-is. */
  runnable: boolean
}

export type SkillsDetection = Pick<ProjectDetection, 'playwright' | 'playwrightCli' | 'meetsMinVersion' | 'hasBundledCli'>

export const CLAUDE_CLI_SKILL_DIR = '.claude/skills/playwright-cli/'
export const AGENTS_CLI_SKILL_DIR = '.agents/skills/playwright-cli/'
export const CLAUDE_TRACE_SKILL_DIR = '.claude/skills/playwright-trace/'

export function buildInstallCommands(detection: SkillsDetection, platforms: readonly Platform[]): InstallPlan {
  const wantsClaude = platforms.includes('claude')
  const wantsAgents = platforms.some(platform => platform !== 'claude')

  const targets: Array<{ flag: string; dir: string }> = []
  if (wantsClaude) targets.push({ flag: '--skills', dir: CLAUDE_CLI_SKILL_DIR })
  if (wantsAgents) targets.push({ flag: '--skills=agents', dir: AGENTS_CLI_SKILL_DIR })

  const base = detection.hasBundledCli
    ? ['npx', 'playwright', 'cli']
    : detection.playwrightCli
      ? ['npx', 'playwright-cli']
      : null

  const commands: InstallCommand[] = []
  const notes: string[] = []

  if (base) {
    for (const target of targets) {
      commands.push({ argv: [...base, 'install', target.flag], label: `playwright-cli skill → ${target.dir}` })
    }
    if (detection.playwright && detection.meetsMinVersion) {
      commands.push({
        argv: ['npx', 'playwright', 'trace', 'install-skill'],
        label: `playwright-trace skill → ${CLAUDE_TRACE_SKILL_DIR}`,
        optional: true,
      })
      notes.push('`trace install-skill` is only in recent Playwright releases; if it errors, run `npx playwright trace --help` to check.')
    }
    return { commands, notes, runnable: true }
  }

  const flags = targets.map(target => target.flag)
  if (detection.playwright) {
    notes.push(`Playwright ${detection.playwright.version} predates the bundled CLI (needs >= 1.62). Upgrade with \`npm i -D @playwright/test@latest\`, then run: ${flags.map(flag => `\`npx playwright cli install ${flag}\``).join(' and ')}.`)
  } else {
    notes.push('Playwright was not detected in this project. Install `@playwright/test` (>= 1.62), then run: ' + flags.map(flag => `\`npx playwright cli install ${flag}\``).join(' and ') + '.')
  }
  notes.push('Or use the standalone CLI: `npm i -g @playwright/cli@latest`, then ' + flags.map(flag => `\`playwright-cli install ${flag}\``).join(' and ') + '.')
  return { commands: [], notes, runnable: false }
}

export function formatCommand(command: InstallCommand): string {
  return command.argv.join(' ')
}

export interface InstallResult {
  ok: boolean
  status: number | null
  error?: string
}

/** Runs one install command in `cwd` with inherited stdio, so the user sees the installer's own output. */
export function runInstall(command: InstallCommand, cwd: string): InstallResult {
  const [file, ...args] = command.argv
  const result = spawnSync(file, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.error) return { ok: false, status: null, error: result.error.message }
  return { ok: result.status === 0, status: result.status }
}
