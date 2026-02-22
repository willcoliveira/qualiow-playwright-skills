import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface ProjectDetection {
  hasPlaywrightConfig: boolean
  isTypeScript: boolean
  cwd: string
}

export async function detectProject(cwd = process.cwd()): Promise<ProjectDetection> {
  const hasPlaywrightConfig =
    existsSync(join(cwd, 'playwright.config.ts')) ||
    existsSync(join(cwd, 'playwright.config.js')) ||
    existsSync(join(cwd, 'playwright.config.mts'))

  const isTypeScript =
    existsSync(join(cwd, 'tsconfig.json')) ||
    existsSync(join(cwd, 'playwright.config.ts'))

  return {
    hasPlaywrightConfig,
    isTypeScript,
    cwd,
  }
}
