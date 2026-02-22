export interface TemplateContext {
  PROJECT_NAME: string
  BASE_URL: string
  FIXTURE_IMPORT_PATH: string
  PAGE_OBJECTS_DIR: string
  TEST_DIR: string
  PAGE_FACTORY_IMPORT: string
  HAS_CUSTOM_FIXTURE: boolean
  NO_CUSTOM_FIXTURE: boolean
  HAS_PAGE_FACTORY: boolean
  NO_PAGE_FACTORY: boolean
}

/**
 * Simple template engine that replaces {{PLACEHOLDER}} values and handles
 * {{#if CONDITION}}...{{/if}} conditional blocks.
 *
 * Preserves `<!-- YOUR PROJECT: ... -->` markers for human editing.
 */
export function renderTemplate(template: string, ctx: TemplateContext): string {
  let result = template

  // Process conditional blocks: {{#if KEY}}...{{/if}}
  result = result.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, key: string, content: string) => {
      const value = ctx[key as keyof TemplateContext]
      return value ? content : ''
    },
  )

  // Replace string placeholders: {{KEY}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = ctx[key as keyof TemplateContext]
    if (value === undefined || value === null) return `{{${key}}}`
    return String(value)
  })

  // Clean up empty lines left by removed conditional blocks (max 2 consecutive)
  result = result.replace(/\n{3,}/g, '\n\n')

  return result
}

export function buildContext(projectInfo: {
  projectName: string
  baseUrl: string
  fixtureImportPath: string
  pageObjectsDir: string
  testDir: string
}): TemplateContext {
  const hasCustomFixture = !!projectInfo.fixtureImportPath && projectInfo.fixtureImportPath !== 'none'

  return {
    PROJECT_NAME: projectInfo.projectName,
    BASE_URL: projectInfo.baseUrl,
    FIXTURE_IMPORT_PATH: projectInfo.fixtureImportPath,
    PAGE_OBJECTS_DIR: projectInfo.pageObjectsDir,
    TEST_DIR: projectInfo.testDir,
    HAS_CUSTOM_FIXTURE: hasCustomFixture,
    NO_CUSTOM_FIXTURE: !hasCustomFixture,
    PAGE_FACTORY_IMPORT: '',
    HAS_PAGE_FACTORY: false, // user can set this later
    NO_PAGE_FACTORY: true,
  }
}
