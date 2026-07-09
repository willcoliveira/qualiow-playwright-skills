import * as p from '@clack/prompts'
import pc from 'picocolors'
import { detectProject } from './prompts.js'
import { plan, writePlannedFiles, relativePath } from './generator.js'
import { getVersion } from './version.js'

export interface CliFlags {
  force: boolean
  help: boolean
  version: boolean
}

export function parseFlags(args: string[]): CliFlags {
  return {
    force: args.includes('--force') || args.includes('-f'),
    help: args.includes('--help') || args.includes('-h'),
    version: args.includes('--version') || args.includes('-v'),
  }
}

const HELP = `
${pc.bold(pc.cyan('wico'))} — Playwright Agent Skills

Usage:
  wico-playwright-agent-skills [command] [flags]

Commands:
  init          Scaffold agent skills into the current project (default)

Flags:
  -f, --force   Overwrite existing files without asking
  -h, --help    Show this help
  -v, --version Show version
`

export async function cli(command: string, args: string[]) {
  const flags = parseFlags([command, ...args])

  if (flags.version) {
    console.log(getVersion())
    return
  }

  if (flags.help) {
    console.log(HELP)
    return
  }

  p.intro(`${pc.bold(pc.cyan('wico'))} — Playwright Agent Skills ${pc.dim(`v${getVersion()}`)}`)

  if (command === 'init' || command.startsWith('-')) {
    await init(flags)
  } else {
    p.log.error(`Unknown command: ${command}`)
    p.log.info('Available commands: init')
    process.exitCode = 1
  }
}

async function init(flags: CliFlags) {
  // Step 1: Project Detection
  p.log.step(`${pc.bold('Step 1:')} Project Detection`)
  const detection = await detectProject()

  if (detection.hasPlaywrightConfig) {
    p.log.success('Found playwright.config.ts')
  } else {
    p.log.warn('No playwright.config.ts found — will generate generic setup')
  }

  if (detection.isTypeScript) {
    p.log.success('TypeScript project detected')
  } else {
    p.log.info('JavaScript project (TypeScript recommended)')
  }

  if (detection.playwrightVersion) {
    if (detection.meetsMinVersion) {
      p.log.success(`Playwright v${detection.playwrightVersion} — ${pc.green('agent debugging features enabled')} (--debug=cli, trace analysis, browser.bind)`)
    } else {
      p.log.warn(`Playwright v${detection.playwrightVersion} — generating ${pc.bold('classic skills')} (upgrade to v1.59+ for agent debugging features)`)
    }
  } else {
    p.log.warn(`Could not detect Playwright version — generating ${pc.bold('classic skills')} (install v1.59+ for agent debugging features)`)
  }

  // Step 2: Agent Platform(s)
  p.log.step(`${pc.bold('Step 2:')} Agent Platform(s)`)
  const platforms = await p.multiselect({
    message: 'Which AI assistant(s) do you use?',
    options: [
      { value: 'claude', label: 'Claude Code', hint: '.claude/skills/' },
      { value: 'cursor', label: 'Cursor', hint: '.cursor/rules/' },
      { value: 'copilot', label: 'GitHub Copilot', hint: '.github/copilot-instructions.md' },
      { value: 'generic', label: 'Generic', hint: '.agent-skills/' },
    ],
    required: true,
  })

  if (p.isCancel(platforms)) {
    p.cancel('Setup cancelled.')
    return
  }

  // Step 3: Skill Packs
  p.log.step(`${pc.bold('Step 3:')} Skill Packs`)
  const packs = await p.multiselect({
    message: 'Which skill packs do you want to install?',
    options: [
      {
        value: 'core',
        label: 'Core patterns',
        hint: 'playwright-patterns, data-strategy, test-review',
      },
      {
        value: 'playwright-cli',
        label: 'Playwright CLI reference',
        hint: 'Browser automation skill',
      },
      {
        value: 'templates',
        label: 'Project templates',
        hint: 'conventions, POM, debugging, generation, planning',
      },
    ],
    required: true,
  })

  if (p.isCancel(packs)) {
    p.cancel('Setup cancelled.')
    return
  }

  // Step 4: Project Info (only if templates selected)
  let projectInfo: ProjectInfo = {
    projectName: 'my-e2e-suite',
    baseUrl: 'https://staging.example.com',
    fixtureImportPath: '',
    pageObjectsDir: 'src/pages',
    testDir: 'src/tests',
  }

  if ((packs as string[]).includes('templates')) {
    p.log.step(`${pc.bold('Step 4:')} Project Info (for templates)`)

    const projectName = await p.text({
      message: 'Project name:',
      placeholder: 'my-e2e-suite',
      defaultValue: 'my-e2e-suite',
    })
    if (p.isCancel(projectName)) { p.cancel('Setup cancelled.'); return }

    const baseUrl = await p.text({
      message: 'Base URL:',
      placeholder: 'https://staging.example.com',
      defaultValue: 'https://staging.example.com',
      validate: (value) => {
        if (!value) return undefined
        try {
          const url = new URL(value)
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return 'Base URL must start with http:// or https://'
          }
        } catch {
          return 'Enter a valid URL (e.g. https://staging.example.com)'
        }
        return undefined
      },
    })
    if (p.isCancel(baseUrl)) { p.cancel('Setup cancelled.'); return }

    const fixtureImportPath = await p.text({
      message: 'Fixture import path (or "none" for @playwright/test):',
      placeholder: '../fixtures/test-fixture',
      defaultValue: '',
    })
    if (p.isCancel(fixtureImportPath)) { p.cancel('Setup cancelled.'); return }

    const pageObjectsDir = await p.text({
      message: 'Page objects directory:',
      placeholder: 'src/pages',
      defaultValue: 'src/pages',
    })
    if (p.isCancel(pageObjectsDir)) { p.cancel('Setup cancelled.'); return }

    const testDir = await p.text({
      message: 'Test directory pattern:',
      placeholder: 'src/tests',
      defaultValue: 'src/tests',
    })
    if (p.isCancel(testDir)) { p.cancel('Setup cancelled.'); return }

    projectInfo = {
      projectName: projectName as string,
      baseUrl: baseUrl as string,
      fixtureImportPath: fixtureImportPath as string,
      pageObjectsDir: pageObjectsDir as string,
      testDir: testDir as string,
    }
  }

  // Step 5: Confirm & Generate
  p.log.step(`${pc.bold('Step 5:')} Confirm & Generate`)

  const plannedFiles = plan({
    platforms: platforms as string[],
    packs: packs as string[],
    projectInfo,
    cwd: process.cwd(),
    meetsMinPlaywrightVersion: detection.meetsMinVersion,
  })

  const existing = plannedFiles.filter(f => f.exists)

  const confirm = await p.confirm({
    message: `Will create ${plannedFiles.length} files across ${(platforms as string[]).length} platform(s). Proceed?`,
  })

  if (p.isCancel(confirm) || !confirm) {
    p.cancel('Setup cancelled.')
    return
  }

  // Overwrite protection: never silently clobber existing files
  if (existing.length > 0 && !flags.force) {
    p.log.warn(`${existing.length} file(s) already exist and will be ${pc.bold('overwritten')}:`)
    for (const file of existing.slice(0, 10)) {
      p.log.message(pc.dim(`  ${relativePath(process.cwd(), file.path)}`))
    }
    if (existing.length > 10) {
      p.log.message(pc.dim(`  ...and ${existing.length - 10} more`))
    }

    const overwrite = await p.confirm({
      message: 'Overwrite existing files? (use --force to skip this check)',
    })

    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel('Setup cancelled — no files were written.')
      return
    }
  }

  const s = p.spinner()
  s.start('Generating files...')

  try {
    const written = writePlannedFiles(plannedFiles)

    s.stop(`Generated ${written.length} files`)

    for (const file of written) {
      p.log.success(pc.dim(relativePath(process.cwd(), file)))
    }

    p.outro(`Done! Next: customize ${pc.cyan('<!-- YOUR PROJECT: ... -->')} markers`)
  } catch (err) {
    s.stop('Failed')
    p.log.error(err instanceof Error ? err.message : String(err))
    process.exitCode = 1
  }
}

export interface ProjectInfo {
  projectName: string
  baseUrl: string
  fixtureImportPath: string
  pageObjectsDir: string
  testDir: string
}
