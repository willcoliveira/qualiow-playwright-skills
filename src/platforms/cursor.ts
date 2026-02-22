import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { writeFile, relativePath, type SkillFile } from '../generator.js'

/**
 * Cursor platform generator.
 *
 * Output structure:
 *   .cursor/rules/playwright-patterns.mdc
 *   .cursor/rules/data-strategy.mdc
 *   .cursor/rules/test-review.mdc
 *   .cursor/rules/page-object-conventions.mdc
 *   .cursor/rules/project-conventions.mdc
 *   .cursor/rules/test-debugging.mdc
 *   .cursor/rules/test-generation.mdc
 *   .cursor/rules/test-planning.mdc
 *   .cursor/rules/playwright-cli.mdc
 *
 * Each file gets Cursor frontmatter with description and globs.
 */
export function generateCursor(cwd: string, skillFiles: SkillFile[], skillsDir: string): string[] {
  const files: string[] = []
  const rulesDir = join(cwd, '.cursor', 'rules')

  // Write the main index rule
  const indexContent = readFileSync(join(skillsDir, 'indexes', 'cursor-rules.mdc'), 'utf-8')
  const indexPath = join(rulesDir, 'playwright-e2e.mdc')
  writeFile(indexPath, indexContent)
  files.push(relativePath(cwd, indexPath))

  // Wrap each skill file in Cursor frontmatter
  for (const skill of skillFiles) {
    if (skill.type === 'playwright-cli' && skill.name !== 'SKILL.md') {
      // Skip playwright-cli reference files — they're too granular for Cursor
      continue
    }

    const baseName = skill.type === 'playwright-cli'
      ? 'playwright-cli'
      : skill.name.replace('.md', '')

    const meta = getCursorMeta(baseName)
    const mdcContent = wrapInCursorFrontmatter(skill.content, meta.description, meta.globs)
    const filePath = join(rulesDir, `${baseName}.mdc`)
    writeFile(filePath, mdcContent)
    files.push(relativePath(cwd, filePath))
  }

  return files
}

interface CursorMeta {
  description: string
  globs: string
}

function getCursorMeta(name: string): CursorMeta {
  const metaMap: Record<string, CursorMeta> = {
    'playwright-patterns': {
      description: 'Playwright API patterns: waitForResponse, toPass, expect.poll, network-first safeguards',
      globs: '**/*.spec.ts,**/*.page.ts',
    },
    'data-strategy': {
      description: 'Test data strategy: static vs dynamic factories',
      globs: '**/test-data/**,**/*.spec.ts',
    },
    'test-review': {
      description: 'Test review checklist: assertions, selectors, timing, isolation, POM, readability, reliability',
      globs: '**/*.spec.ts',
    },
    'page-object-conventions': {
      description: 'Page Object Model conventions: class structure, selectors, component composition',
      globs: '**/*.page.ts,**/components/**',
    },
    'project-conventions': {
      description: 'Project conventions: MUST/SHOULD/WON\'T rules, file organization, CI/CD',
      globs: '**/*.spec.ts,**/*.page.ts,**/fixtures/**',
    },
    'test-debugging': {
      description: 'Test debugging: failure patterns, root cause classification, decision tree',
      globs: '**/*.spec.ts',
    },
    'test-generation': {
      description: 'Test generation: templates, import rules, fixture docs, page factory',
      globs: '**/*.spec.ts,**/*.page.ts',
    },
    'test-planning': {
      description: 'Test planning: exploration workflow, plan template, checklist',
      globs: '**/*.spec.ts',
    },
    'playwright-cli': {
      description: 'Playwright CLI: browser automation commands for testing and exploration',
      globs: '**/*.spec.ts',
    },
  }

  return metaMap[name] ?? {
    description: `Playwright skill: ${name}`,
    globs: '**/*.spec.ts',
  }
}

function wrapInCursorFrontmatter(content: string, description: string, globs: string): string {
  return `---
description: ${description}
globs: "${globs}"
---

${content}`
}
