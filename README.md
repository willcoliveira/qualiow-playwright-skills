# wico — Playwright Agent Skills

Reusable Playwright E2E testing knowledge for AI coding assistants, installed as a standard [Agent Skill](https://agentskills.io). One command scaffolds a `playwright-e2e` skill into your project for **Claude Code**, **Cursor**, **GitHub Copilot**, and any other agent that reads `.agents/skills/` (Codex, Gemini CLI, ...).

## What it does

Instead of every QA engineer teaching their assistant the same Playwright practices from scratch, you install a curated skill once and the agent knows how to plan, write, review and debug tests properly. The skill covers:

- Locators and assertions: strict mode, composition, soft assertions, aria snapshots, visual comparison, mocking, clock
- Fixtures and authentication: `base.extend`, worker scope, setup projects and `storageState`
- Playwright API patterns: `waitForResponse` ordering, `toPass`, `expect.poll`, network-first safeguards
- Test data strategy: static data vs dynamic factories
- CI and flake triage: sharding, reporters, retries, `describe.configure`, `test.fail/fixme/slow`
- Agent debugging: `npx playwright test --debug=cli`, `playwright-cli attach`, trace triage from the terminal
- Review checklist and quality gates
- Optional project templates customised with your project info: conventions, page objects, debugging, generation, planning

The CLI detects your Playwright version, generates the skill in the right place for each platform, and points you at Playwright's own installer for the official `playwright-cli` and `playwright-trace` skills.

## Install

Requires Node.js >= 20. In your Playwright project:

```bash
npx wico-playwright-agent-skills init
```

The CLI detects the project, asks which platforms and packs you want, and generates the files. Re-running is safe: unchanged files are skipped, changed files are listed before anything is overwritten.

### Non-interactive use (CI, scripts, agents)

No prompts are shown with `--yes`, on CI, or without a TTY. Only `--platforms` is required; everything else has a default.

```bash
npx wico-playwright-agent-skills init --platforms claude,cursor --yes
npx wico-playwright-agent-skills init --platforms claude --packs core,templates \
    --project-name shop-e2e --base-url https://staging.shop.example --yes --force
npx wico-playwright-agent-skills init --platforms copilot --dry-run
```

### Flags

| Flag | Description |
|------|-------------|
| `--platforms <list>` | Comma-separated: `claude`, `cursor`, `copilot`, `agents` (`generic` is accepted as an alias of `agents`) |
| `--packs <list>` | Comma-separated: `core`, `templates`, `playwright-cli`. `core` is always included |
| `--project-name <name>` | Used in the skill description and templates (default: `name` from `package.json`) |
| `--base-url <url>` | Application base URL for the templates |
| `--fixture-import-path <path>` | Custom fixture import path, or `none` for plain `@playwright/test` |
| `--page-objects-dir <dir>` | Page objects directory (default `src/pages`) |
| `--test-dir <dir>` | Test directory (default `src/tests`) |
| `-y, --yes` / `--non-interactive` | Never prompt; use flags and defaults |
| `--dry-run` | Print the plan and exit without writing |
| `-f, --force` | Overwrite files that differ from the generated content |
| `--clean-legacy` | Remove output left behind by 1.x without asking |
| `--install-playwright-skills` | Run Playwright's own skill installer instead of printing the commands |
| `-h, --help`, `-v, --version` | Help and version |

Exit codes: `0` success or dry run, `1` usage error, refused overwrite or failed install, `130` cancelled.

## What gets generated

| Platform | Files |
|----------|-------|
| `claude` | `.claude/skills/playwright-e2e/SKILL.md` + `references/*.md` |
| `cursor` | `.agents/skills/playwright-e2e/` + `.cursor/rules/playwright-e2e.mdc` (auto-attached pointer rule with the key rules) |
| `copilot` | `.agents/skills/playwright-e2e/` + `.github/instructions/playwright-e2e.instructions.md` (path-specific rules) + a short marker block in `.github/copilot-instructions.md` |
| `agents` | `.agents/skills/playwright-e2e/` only (read by Cursor, Copilot, Codex, Gemini CLI) |

Cursor, Copilot and `agents` share one `.agents/skills/` tree, so selecting several of them writes the skill once. The `SKILL.md` frontmatter follows the Agent Skills spec (`name`, `description`) and carries a `metadata.generator` marker so later runs can recognise their own output.

The Copilot marker block is merged: anything you wrote outside `<!-- wico-playwright-agent-skills:start/end -->` is preserved, and the block written by earlier versions is replaced.

### Skill packs

**core** (always installed) ships generic, project-independent references:

| Reference | Covers |
|-----------|--------|
| `playwright-patterns.md` | `waitForResponse` ordering, `toPass` with short inner timeouts, `expect.poll`, network-first safeguards, Zod validation |
| `api-testing-patterns.md` | Testing an HTTP service with no browser: `APIRequestContext`, per-call credentials for negative auth tests, schema-validated responses, budgets from the service's own timings, delta assertions on shared environments |
| `locators-and-assertions.md` | Strict mode, selector ladder, `filter`/`and`/`or`, `.contentFrame()`, web-first and soft assertions, aria snapshots, `toHaveScreenshot`, `page.route`/HAR, `page.clock` |
| `fixtures-and-auth.md` | `base.extend` test/worker fixtures, `test.use`, option fixtures, `mergeTests`, setup project + `storageState`, per-role and per-worker accounts |
| `data-strategy.md` | Static data vs dynamic factories, decision table |
| `test-review.md` | 7-category checklist, quality gates, severity levels |
| `pass-rate-and-flake-analysis.md` | Proving determinism by running a suite N times: the four outcomes a JSON report distinguishes, per-test stability, why `retries` hide races |
| `ci-and-flake-triage.md` | CI config, `describe.configure`, sharding with blob reports, GitHub Actions example, `test.fail/fixme/slow`, flake triage |
| `agent-debugging.md` | The `--debug=cli` attach loop, terminal trace triage, `browser.bind()`; falls back to Inspector/UI mode/`show-trace` on Playwright < 1.59 |

**templates** adds project-specific references rendered with your answers and `<!-- YOUR PROJECT: ... -->` markers to fill in:

| Reference | Covers |
|-----------|--------|
| `project-conventions.md` | MUST/SHOULD/WON'T rules, file organisation, test data, CI conventions, ESLint plugin rules |
| `page-object-conventions.md` | Class structure, selector priority, component composition, iframes, naming |
| `test-generation.md` | Spec template, import rules, page objects in tests, form filling, fixtures and tags tables |
| `test-planning.md` | Exploration with `playwright-cli`, flow phases, plan template, checklist |
| `test-debugging.md` | Failure patterns, debugging workflow, root cause classification, app bug vs test bug decision tree, bug report template |

**playwright-cli** writes no files. Playwright ships and installs its own `playwright-cli` and `playwright-trace` skills, so this pack detects your Playwright version and prints (or runs, with `--install-playwright-skills`) the official commands:

```bash
npx playwright cli install --skills            # → .claude/skills/playwright-cli/  (Playwright >= 1.62)
npx playwright cli install --skills=agents     # → .agents/skills/playwright-cli/
npx playwright trace install-skill             # → .claude/skills/playwright-trace/ (recent releases)
```

On older Playwright versions it prints the `npm i -g @playwright/cli@latest` alternative instead. The generator never writes into `*/skills/playwright-cli/` itself.

### Playwright version detection

The CLI reads the installed `@playwright/test` (or `playwright`) version from `node_modules`, walking up through parent directories for hoisted monorepo installs, and falls back to the range in `package.json`. Nothing from the project is executed.

- **>= 1.59**: the references describe `npx playwright test --debug=cli`, `playwright-cli attach`, `npx playwright trace` and `browser.bind()`.
- **< 1.59 or not found**: the same references describe the Playwright Inspector, UI mode and `show-trace` instead. Pre-releases count as below the version they precede.

## Template placeholders

Templates use `{{PLACEHOLDER}}` substitution and `{{#if}}...{{else}}...{{/if}}` blocks (nesting supported), rendered by a small built-in engine.

| Placeholder | Description |
|-------------|-------------|
| `{{PROJECT_NAME}}` | Project name |
| `{{BASE_URL}}` | Application base URL |
| `{{FIXTURE_IMPORT_PATH}}` | Custom fixture import path (empty when `none`) |
| `{{PAGE_OBJECTS_DIR}}` | Page objects directory |
| `{{TEST_DIR}}` | Test directory |

| Condition | True when |
|-----------|-----------|
| `HAS_CUSTOM_FIXTURE` | A fixture import path was given |
| `HAS_PLAYWRIGHT_159` | Playwright >= 1.59 was detected |
| `HAS_TEMPLATES` | The `templates` pack is selected |
| `HAS_PLAYWRIGHT_CLI` | The `playwright-cli` pack is selected |

## After setup

1. Fill in the `<!-- YOUR PROJECT: ... -->` markers (components, fixtures, env vars, tags, flow phases).
2. Adjust the MUST/SHOULD/WON'T rules in `project-conventions.md` to your team's agreements.
3. Install the official Playwright skills (the CLI prints the commands).
4. Ask your assistant to write a test or debug a failure and check that it follows the skill.

## Upgrading from 1.x

2.0.0 changes where files go and what they contain. Run `init` again in the project: the new files are written, the Copilot block is replaced in place, and anything 1.x left behind is listed:

- `.agent-skills/` (the old generic output; no tool reads it)
- the nine per-skill `.cursor/rules/*.mdc` files (replaced by one pointer rule plus `.agents/skills/`)
- `.claude/skills/playwright-cli/` when it is the old vendored copy (reinstall the official skill afterwards)
- references inside a generated skill directory that the selected packs no longer produce

Confirm the removal interactively, or pass `--clean-legacy`. Files without positive evidence that this tool wrote them are never touched. See `CHANGELOG.md` for the full list of breaking changes.

## Development

```bash
git clone git@github.com:willcoliveira/qualiow-playwright-skills.git
cd qualiow-playwright-skills
npm install

npm run dev -- init --platforms claude --dry-run   # run from source
npm run lint                                        # type check
npm test                                            # node:test suite
npm run build                                       # single ESM bundle in dist/
npx tsx scripts/validate-output.ts <project-dir>    # validate generated output
```

The test suite renders every platform × pack × version × fixture combination into a temp directory and validates the result: no unrendered template syntax, every relative link resolves, `SKILL.md` frontmatter matches the Agent Skills spec, Cursor rules and Copilot instructions have the required keys, and a second run reports every file unchanged. CI repeats that with the built package in a scratch project.

### Project structure

```
bin/init.ts                 CLI entry point
src/
  cli.ts                    Flags (node:util.parseArgs), prompts, non-interactive flow, exit codes
  detect.ts                 Playwright/config detection without executing project code
  generator.ts              plan() → PlannedFile[] with new/modified/unchanged status; writePlannedFiles()
  template-engine.ts        {{PLACEHOLDER}} and {{#if}}/{{else}} rendering
  frontmatter.ts            Minimal YAML frontmatter parse/serialize
  migrate.ts                Detection and removal of 1.x output
  playwright-skills.ts      Install-command bridge to Playwright's own skill installer
  validate.ts               Output validation used by tests and CI
  platforms/
    skills-dir.ts           Standard <root>/playwright-e2e/{SKILL.md,references/} writer
    claude.ts               .claude/skills/
    agents.ts               .agents/skills/
    cursor.ts               .agents/skills/ + .cursor/rules/playwright-e2e.mdc
    copilot.ts              .agents/skills/ + .github/instructions/ + copilot-instructions.md merge
skills/
  core/                     Generic references (always installed)
  templates/                Project references rendered with your answers
  indexes/                  skill.md (SKILL.md), cursor-rules.mdc, copilot-instructions.md, copilot-pointer.md
scripts/validate-output.ts  CLI wrapper around src/validate.ts
tests/                      node:test suites
```

## Contributing

1. Fork the repository and create a branch (`git checkout -b feat/my-skill`)
2. Add or edit references under `skills/`; new `.md` files in `core/` and `templates/` are picked up automatically and linked from `skills/indexes/skill.md`
3. Run `npm run lint && npm test`
4. Open a pull request (CI runs lint, tests, build, package check, and end-to-end generation)

## License

MIT
