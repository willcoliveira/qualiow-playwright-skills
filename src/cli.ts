import * as p from '@clack/prompts'
import pc from 'picocolors'
import { detectProject } from './prompts.js'
import { generate } from './generator.js'

const VERSION = '0.1.0'

export async function cli(command: string, _args: string[]) {
  p.intro(`${pc.bold(pc.cyan('wico'))} — Playwright Agent Skills ${pc.dim(`v${VERSION}`)}`)

  if (command === 'init') {
    await init()
  } else {
    p.log.error(`Unknown command: ${command}`)
    p.log.info('Available commands: init')
    process.exit(1)
  }
}

async function init() {
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
    process.exit(0)
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
    process.exit(0)
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
    if (p.isCancel(projectName)) { p.cancel('Setup cancelled.'); process.exit(0) }

    const baseUrl = await p.text({
      message: 'Base URL:',
      placeholder: 'https://staging.example.com',
      defaultValue: 'https://staging.example.com',
    })
    if (p.isCancel(baseUrl)) { p.cancel('Setup cancelled.'); process.exit(0) }

    const fixtureImportPath = await p.text({
      message: 'Fixture import path (or "none" for @playwright/test):',
      placeholder: '../fixtures/test-fixture',
      defaultValue: '',
    })
    if (p.isCancel(fixtureImportPath)) { p.cancel('Setup cancelled.'); process.exit(0) }

    const pageObjectsDir = await p.text({
      message: 'Page objects directory:',
      placeholder: 'src/pages',
      defaultValue: 'src/pages',
    })
    if (p.isCancel(pageObjectsDir)) { p.cancel('Setup cancelled.'); process.exit(0) }

    const testDir = await p.text({
      message: 'Test directory pattern:',
      placeholder: 'src/tests',
      defaultValue: 'src/tests',
    })
    if (p.isCancel(testDir)) { p.cancel('Setup cancelled.'); process.exit(0) }

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

  const fileCount = estimateFileCount(platforms as string[], packs as string[])

  const confirm = await p.confirm({
    message: `Will create ~${fileCount} files across ${(platforms as string[]).length} platform(s). Proceed?`,
  })

  if (p.isCancel(confirm) || !confirm) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const s = p.spinner()
  s.start('Generating files...')

  try {
    const result = await generate({
      platforms: platforms as string[],
      packs: packs as string[],
      projectInfo,
      cwd: process.cwd(),
    })

    s.stop(`Generated ${result.filesCreated} files`)

    for (const file of result.files) {
      p.log.success(pc.dim(file))
    }

    p.outro(`Done! Next: customize ${pc.cyan('<!-- YOUR PROJECT: ... -->')} markers`)
  } catch (err) {
    s.stop('Failed')
    p.log.error(String(err))
    process.exit(1)
  }
}

function estimateFileCount(platforms: string[], packs: string[]): number {
  let total = 0

  const coreCount = 3
  const cliCount = 8
  const templateCount = 5

  for (const platform of platforms) {
    if (platform === 'copilot') {
      // Copilot always produces a single consolidated file
      total += 1
      continue
    }

    // 1 index file per platform
    let count = 1

    if (packs.includes('core')) count += coreCount
    if (packs.includes('templates')) count += templateCount

    if (packs.includes('playwright-cli')) {
      // Cursor only writes the SKILL.md index, not the 7 reference files
      count += platform === 'cursor' ? 1 : cliCount
    }

    total += count
  }

  return total
}

export interface ProjectInfo {
  projectName: string
  baseUrl: string
  fixtureImportPath: string
  pageObjectsDir: string
  testDir: string
}
