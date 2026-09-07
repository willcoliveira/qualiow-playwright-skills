# Changelog

## 2.0.0 — 2026-09-07

Rework around native Agent Skills support in Cursor, GitHub Copilot, Codex and Gemini CLI, and around Playwright shipping its own `playwright-cli` and `playwright-trace` skills.

### Breaking changes

- **Output layout.** Cursor, Copilot and the former "generic" target now share one `.agents/skills/playwright-e2e/` skill. Cursor gets a single pointer rule `.cursor/rules/playwright-e2e.mdc` instead of nine full-copy rules; Copilot gets `.github/instructions/playwright-e2e.instructions.md` plus a short marker block in `.github/copilot-instructions.md` instead of one huge file. `.agent-skills/` is no longer written. Platform id `generic` is renamed `agents` (the old name still works).
- **`playwright-cli` pack no longer ships files.** The vendored copy of the skill was stale and overwrote the official one at the same path. The pack now detects your Playwright version and prints or runs `npx playwright cli install --skills` / `--skills=agents` and `npx playwright trace install-skill`.
- **`core` is always installed.** The index links to it, so it can no longer be deselected.
- **Non-interactive runs require `--platforms`** and refuse to overwrite changed files without `--force` (exit code 1). 1.x hung without a TTY.
- **Template conditionals** `NO_CUSTOM_FIXTURE`, `NO_PLAYWRIGHT_159`, `HAS_PAGE_FACTORY`, `NO_PAGE_FACTORY` and `PAGE_FACTORY_IMPORT` are removed in favour of `{{else}}`; `HAS_TEMPLATES` and `HAS_PLAYWRIGHT_CLI` are added. Only affects forks that edit `skills/`.
- `skills/indexes/skill-index.md` is renamed `skill.md`; `claude-skill.md` and `skill-diagrams.md` are removed.

### Added

- Non-interactive mode (`--yes`, CI, no TTY) with flags for every prompt, `--dry-run`, `--clean-legacy`, `--install-playwright-skills`, and meaningful exit codes.
- `SKILL.md` frontmatter (`name`, `description`, `metadata.generator`) so Claude Code can tell when to apply the skill.
- Plan statuses `new` / `modified` / `unchanged`; unchanged files are never rewritten, and a re-run reports "Already up to date".
- Migration: 1.x leftovers (`.agent-skills/`, per-skill Cursor rules, the vendored `playwright-cli` skill, stale references) are detected with positive evidence and removed only on confirmation or `--clean-legacy`.
- Playwright detection walks up `node_modules` (monorepos), falls back to the `package.json` range, recognises `playwright.config.{ts,mts,cts,js,mjs,cjs}`, treats pre-releases as below their version, and never executes project code.
- New core references: `agent-debugging.md`, `fixtures-and-auth.md`, `locators-and-assertions.md`, `ci-and-flake-triage.md`.
- Output validator (`src/validate.ts`, `scripts/validate-output.ts`) run over every platform × pack × version × fixture combination in tests and in a CI end-to-end job.
- Template engine: `{{else}}`, nested blocks, blank-line collapsing that leaves fenced code alone, and an error on unknown condition keys.

### Fixed

- Cursor and Copilot output wrapped an already-frontmattered file in a second frontmatter block and dropped every linked reference.
- Generic output linked sibling files that were written under `references/`.
- `--debug=cli` was described as printing each step; it pauses the test for `playwright-cli attach`. `browser.bind()` was called without its required name and treated as a URL. `snapshot --selector` does not exist; trace commands use `--phase`, not `--name`. `test-reports/` is `test-results/`.
- The custom-fixture spec template imported `test` but used `expect`; `goto` hardcoded the base URL; tags were in titles instead of `{ tag: [...] }`.
- Contradictory guidance: trace "off on CI" vs `on-first-retry`; 3-tier vs 5-tier selector ladder; `frameLocator` listed as a selector priority; undeclared `request` and `UserSchema` in examples; Cursor rule without `alwaysApply` and with quoted globs.
- Confirm prompts default to a safe answer; cancelling exits non-zero; `plan()` errors are reported instead of crashing.

## 1.2.0

- Guardrails, tests, CI, dependency updates.

## 1.1.0

- Playwright 1.59 agent debugger content and vendored `playwright-cli` skill.

## 1.0.0

- Initial release.
