# wico — Playwright Agent Skills

Reusable Playwright E2E testing knowledge for AI coding assistants. This project provides a CLI that scaffolds agent skills into any Playwright project, formatted for the platform you use — **Claude Code**, **Cursor**, **GitHub Copilot**, or a generic `.agent-skills/` directory.

## Project Description

This project extracts the generic, battle-tested patterns from real-world Playwright E2E suites into a standalone, installable package. The idea is simple: instead of every QA engineer teaching their AI assistant the same Playwright best practices from scratch, you install a set of curated skills once and your agent immediately knows how to write, debug, and review tests properly.

The skills cover:
- Playwright API patterns (`waitForResponse`, `toPass`, `expect.poll`, network-first safeguards)
- Test data strategy (static vs dynamic factories)
- Page Object Model conventions (selectors, composition, naming)
- Project conventions (MUST/SHOULD/WON'T rules, file organization, CI/CD)
- Test debugging (failure patterns, root cause classification, app bug vs test bug decision tree)
- Test generation and planning (templates, checklists, exploration workflow)
- Playwright CLI reference (browser automation for interactive exploration)

The CLI detects your project setup, asks which platforms and skill packs you want, replaces template placeholders with your project info, and generates the files in the right format for each platform.

## How to Install This Project

### Prerequisites

#### Node.js

Having Node.js installed is mandatory to run this project. Download and install from [nodejs.org](https://nodejs.org/en/download/).

After installation, open a terminal and verify the version (must be >= v18):

```bash
# Verify Node.js version
node -v

# Verify npm version
npm -v
```

#### Git

Git is required to clone the repository. Download from [git-scm.com](https://git-scm.com/downloads) if not already installed.

```bash
git --version
```

### Clone and Setup

```bash
# Clone the repository
git clone git@github.com:willcoliveira/qualiow-playwright-skills.git
cd qualiow-playwright-skills

# Install dependencies
npm install
```

### Quick Start (npx)

If you just want to use it in an existing Playwright project without cloning:

```bash
# Run directly in your Playwright project directory
npx wico-playwright-agent-skills init
```

## How to Use the CLI

### Running the Init Command

Navigate to your Playwright project (the one where you want skills installed) and run:

```bash
npx wico-playwright-agent-skills init
```

The CLI walks you through 5 steps:

```
  wico — Playwright Agent Skills v0.1.0

  Step 1: Project Detection
  ─────────────────────────
  ✓ Found playwright.config.ts
  ✓ TypeScript project detected

  Step 2: Agent Platform(s)
  ─────────────────────────
  Which AI assistant(s) do you use? (space to select)
  > [x] Claude Code        → .claude/skills/
    [x] Cursor              → .cursor/rules/
    [ ] GitHub Copilot      → .github/copilot-instructions.md
    [x] Generic             → .agent-skills/

  Step 3: Skill Packs
  ─────────────────────────
  > [x] Core patterns (playwright-patterns, data-strategy, test-review)
    [x] Playwright CLI reference
    [x] Project templates (conventions, POM, debugging, generation, planning)

  Step 4: Project Info (for templates)
  ─────────────────────────
  Project name: my-e2e-suite
  Base URL: https://staging.example.com
  Fixture import path: ../fixtures/test-fixture (or "none")
  Page objects dir: src/pages
  Test dir pattern: src/tests

  Step 5: Confirm & Generate
  ─────────────────────────
  Will create 24 files across 3 platforms.
  Proceed? (Y/n)

  ✓ Done! Next: customize <!-- YOUR PROJECT: ... --> markers
```

### Running from Source (Development)

If you cloned the repo and want to test locally:

```bash
# Run with tsx (no build needed)
npx tsx bin/init.ts init

# Or build first, then run the compiled version
npm run build
node dist/bin/init.js init
```

### Type Checking

```bash
npm run lint
```

### Building for Distribution

```bash
npm run build
```

## What Gets Generated

### Platform Output Formats

Each platform has its own convention for where AI instructions live. The CLI generates files in the right format for each one:

| Platform | Output Path | Format |
|----------|-------------|--------|
| Claude Code | `.claude/skills/playwright-e2e/` | SKILL.md index + `references/` directory |
| Cursor | `.cursor/rules/*.mdc` | Frontmatter with `description` + `globs` per file |
| GitHub Copilot | `.github/copilot-instructions.md` | Single consolidated markdown file (appends if exists) |
| Generic | `.agent-skills/` | SKILL.md index + `references/` directory |

### Skill Packs

#### Core Patterns (shipped as-is)

These are generic Playwright best practices that apply to any project:

| Skill | What It Covers |
|-------|----------------|
| **playwright-patterns** | `waitForResponse` ordering, `toPass` retry blocks with short inner timeouts, `expect.poll` for API polling, network-first safeguards, Zod validation |
| **data-strategy** | When to use static data vs dynamic factories, decision criteria table, factory pattern template with `@faker-js/faker` |
| **test-review** | 7-category review checklist (assertions, selectors, timing, isolation, POM, readability, reliability), quality gates, severity definitions |

#### Playwright CLI Reference (shipped as-is)

Complete reference for the `playwright-cli` browser automation tool:

| Skill | What It Covers |
|-------|----------------|
| **SKILL.md** | All CLI commands — open, click, fill, snapshot, tabs, storage, network, devtools |
| **request-mocking** | Route interception, conditional responses, response modification, network failure simulation |
| **running-code** | Custom Playwright code execution, geolocation, permissions, media emulation, wait strategies |
| **session-management** | Named browser sessions, isolation properties, concurrent workflows |
| **storage-state** | Cookies, localStorage, sessionStorage, IndexedDB, authentication state reuse |
| **test-generation** | Record interactions as Playwright code, semantic locator generation |
| **tracing** | Capture and analyze execution traces, trace output file structure |
| **video-recording** | Record browser sessions as WebM video |

#### Project Templates (customized with your project info)

These templates get `{{PLACEHOLDER}}` values replaced with your project-specific info during generation. They also include `<!-- YOUR PROJECT: ... -->` markers where you should add your own details after setup.

| Skill | What It Covers |
|-------|----------------|
| **page-object-conventions** | POM class structure, selector priority, component composition, page factory pattern, iframe handling, method/naming conventions |
| **project-conventions** | MUST/SHOULD/WON'T constitution-style rules, file organization, test data management, CI/CD conventions, ESLint Playwright plugin rules |
| **test-debugging** | Common failure patterns table, debugging workflow (error → CLI → trace → CI reports), root cause classification, app bug vs test bug decision tree, bug report template |
| **test-generation** | Test spec template, critical import rules, page object structure, form filling patterns, fixture documentation, tags reference |
| **test-planning** | Exploration workflow with playwright-cli, application flow phases, test plan template (objective, environment, flow steps, auth, teardown, tags), planning checklist |

## Template Placeholder System

Templates use a simple `{{PLACEHOLDER}}` syntax with a lightweight regex engine (no Handlebars dependency).

### String Placeholders

| Placeholder | Description | Example Value |
|-------------|-------------|---------------|
| `{{PROJECT_NAME}}` | Your project name | `my-e2e-suite` |
| `{{BASE_URL}}` | Application base URL | `https://staging.example.com` |
| `{{FIXTURE_IMPORT_PATH}}` | Custom fixture import path | `../fixtures/test-fixture` |
| `{{PAGE_OBJECTS_DIR}}` | Page objects directory | `src/pages` |
| `{{TEST_DIR}}` | Test directory pattern | `src/tests` |

### Conditional Blocks

```
{{#if HAS_CUSTOM_FIXTURE}}
import { test } from '{{FIXTURE_IMPORT_PATH}}'
{{/if}}
{{#if NO_CUSTOM_FIXTURE}}
import { test } from '@playwright/test'
{{/if}}
```

### Extension Points

After generation, search for `<!-- YOUR PROJECT: ... -->` markers in the generated files. These are placeholders where you should add your project-specific details:

```markdown
<!-- YOUR PROJECT: Add your component inventory here -->
<!-- YOUR PROJECT: Document your test data files here -->
<!-- YOUR PROJECT: List your required environment variables here -->
```

## After Setup

Once the files are generated, here's what to do next:

1. **Review the generated files** for your platform and make sure they look right
2. **Search for `<!-- YOUR PROJECT: ... -->` markers** and fill in your project-specific details (components, fixtures, env vars, tags, etc.)
3. **Customize the MUST/SHOULD/WON'T rules** in `project-conventions.md` to match your team's agreements
4. **Add your failure patterns** to `test-debugging.md` — the common issues your team hits
5. **Document your page objects and fixtures** in `test-generation.md` so the agent knows what's available
6. **Test it** — ask your AI assistant to write a test or debug a failure and see if it follows the skills

## Project Structure

```
qualiow-playwright-skills/
├── bin/
│   └── init.ts                       # CLI entry point
├── src/
│   ├── cli.ts                        # CLI orchestrator (5-step flow with @clack/prompts)
│   ├── prompts.ts                    # Project detection (playwright.config.ts, tsconfig.json)
│   ├── generator.ts                  # File generation orchestrator
│   ├── template-engine.ts            # {{PLACEHOLDER}} + {{#if}} replacement engine
│   └── platforms/
│       ├── claude.ts                 # .claude/skills/ generator
│       ├── cursor.ts                 # .cursor/rules/*.mdc generator
│       ├── copilot.ts                # .github/copilot-instructions.md generator
│       └── generic.ts                # .agent-skills/ generator
├── skills/
│   ├── core/                         # Shipped as-is (generic Playwright knowledge)
│   │   ├── playwright-patterns.md
│   │   ├── data-strategy.md
│   │   └── test-review.md
│   ├── templates/                    # Shipped with {{PLACEHOLDERS}} for customization
│   │   ├── page-object-conventions.md
│   │   ├── project-conventions.md
│   │   ├── test-debugging.md
│   │   ├── test-generation.md
│   │   └── test-planning.md
│   ├── playwright-cli/               # Playwright CLI skill (as-is)
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── request-mocking.md
│   │       ├── running-code.md
│   │       ├── session-management.md
│   │       ├── storage-state.md
│   │       ├── test-generation.md
│   │       ├── tracing.md
│   │       └── video-recording.md
│   └── indexes/                      # Platform-specific SKILL.md indexes
│       ├── skill-index.md            # Generic index with decision tree
│       ├── claude-skill.md           # Claude SKILL.md format
│       ├── cursor-rules.mdc          # Cursor frontmatter format
│       └── copilot-instructions.md   # Copilot single-file format
├── examples/                         # Example generated output per platform
│   ├── claude/
│   ├── cursor/
│   ├── copilot/
│   └── generic/
├── package.json
├── tsconfig.json
├── tsup.config.ts                    # Build config (single ESM bundle)
├── .gitignore
└── LICENSE
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.7+ |
| Runtime | Node.js | 18+ |
| CLI Prompts | @clack/prompts | 0.9+ |
| Colors | picocolors | 1.1+ |
| Build | tsup | 8.3+ |
| Dev Runner | tsx | 4.19+ |

## Contributing

If you'd like to contribute new skills, improve existing templates, or add support for another platform:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-skill`)
3. Make your changes
4. Run `npm run lint` to verify types
5. Submit a pull request

## License

MIT
