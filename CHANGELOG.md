# Changelog

## 2.3.0 — 2026-09-15

Catches the content up with Playwright 1.60–1.63. No CLI or layout change; the detection thresholds
(1.59 for the agent-debug workflow, 1.62 for the bundled CLI) are unchanged and correct.

Version differences at this granularity are inline notes in the reference, not a new template
condition, so a reader below 1.63 still sees what upgrading buys them.

### Changed

- **`@destructive` now locks the resource instead of serialising the suite.** Playwright 1.63 adds
  `test('...', { lock: 'store-settings' }, ...)`, and tests sharing a lock name never run at the
  same time across files, workers and projects while everything else stays parallel. The 2.1.0
  advice — a separate serial pass — is kept as the pre-1.63 fallback. The rule that matters is to
  lock on the **resource**, not on the tag: `lock: 'destructive'` would serialise every destructive
  test against every other, which is the blunt behaviour this replaces.
- The container image in the CI example moves to `v1.63.0-noble`. It was the only hardcoded
  Playwright version in the content, and it had fallen a release behind the instruction beside it.

### Added

- **`failOnFlakyTests`** in the CI config and the determinism reference. This content already argued
  that retries are a safety net rather than a strategy and had no mechanism to back it. The setting
  exits non-zero when anything passed only on retry, so the retry still produces artifacts to
  diagnose from and the build still goes red.
- **`locator.visible()`**, alongside `.filter({ visible: true })` — Playwright names it the
  recommended replacement for the `:visible` pseudo-class.
- **`apiResponse.timing()`** for request budgets derived from what the service actually did, with
  the two caveats that bite: every value is `-1` when the response comes from a HAR file, and one
  observation is not a budget.
- **Typed request helpers (`request.get<User>()`) documented as a companion to schema validation,
  not a replacement.** The generic types the response at compile time and asserts nothing at
  runtime, so a service returning `{}` yields a value the compiler vouches for and a failure three
  assertions later — the same false confidence the rest of that reference argues against.


## 2.2.0 — 2026-09-15

Five procedures, as commands on every platform that has them.

### Added

- **A `workflows` pack.** `/playwright-plan`, `/playwright-test`, `/playwright-debug`,
  `/playwright-review` and `/playwright-determinism` — the operating procedure applied to the five
  jobs it classifies.
- **One body per procedure, one copy in the repository.** Bodies render to
  `<skill>/workflows/<id>.md`, byte-identical in `.claude/skills/` and `.agents/skills/`, and each
  platform's command file is a five-line wrapper pointing at it: `.claude/commands/`,
  `.cursor/commands/`, `.github/prompts/*.prompt.md` (`mode: agent`). A procedure cannot differ
  between targets because only one copy of it exists.
- **A `## Procedures` table in `SKILL.md`** so the shared `.agents` tree — which has no command
  construct — reaches every procedure by name. Same content, worse ergonomics, stated plainly.
- **Four sub-agents on Claude Code**: `pw-suite-indexer`, `pw-page-mapper`, `pw-failure-indexer`,
  `pw-review-scanner`, all Haiku. Each maps files to one artifact and makes no judgement, so running
  the same work inline gives the same artifact — they are an optimisation, never a capability the
  skill depends on.
- **`references/delegation-rules.md`** — delegate the I/O, keep the reasoning, with the
  never-delegate list and why a delegate's verdict is discarded rather than weighed.
- **Validators for commands, prompts and agents**, dispatched by directory because `.prompt.md`
  also ends in `.md`. An agent body must declare a `## Forbidden` section and must not contain a
  judgement verb outside it.
- **`tests/parity.test.ts`** — identical bodies in both trees across every combination, every
  wrapper resolving to a body that exists, every procedure reachable on a platform with no commands,
  and nothing advertised when the pack is not installed.
- The in-process matrix grows from 80 combinations to 120; CI gains a workflows scaffold that checks
  both invariants from the packed tarball.

### Fixed

- `migrate` swept `references/` only, so deselecting a pack or renaming a procedure left a command
  file pointing at a body that no longer exists — a command that appears in the palette and does
  nothing. Command, prompt, agent and workflow files are now swept too, identified by their
  ownership marker so a hand-written command is never touched.


## 2.1.0 — 2026-09-15

Gives the generated skill a procedure to follow, and adds the checks that keep the four platform
copies saying the same thing.

### Added

- **An operating procedure** (`skills/core/workflow.md`, linked from every index). Eight phases —
  classify, route, explore, plan with a confidence score, stop for approval, apply, verify, report —
  with the score anchored to evidence rather than to feel, and a floor: below 5 the agent emits no
  plan at all and asks instead. Plus Direct Mode's one surviving rule (verify the premise before
  fixing what you were told is broken) and the anti-invention rules: explore before generate, a
  skeleton counts as a placeholder, and no substitute exploration when `playwright-cli` is absent.
- **`allowed-tools` on the generated `SKILL.md`**, scoped to the `playwright-cli` and
  `npx playwright` invocations the references actually contain, so the debugging workflow no longer
  prompts on every step.
- **A rule-drift gate** (`skills/rules.manifest.tsv`, `src/rules.ts`, `scripts/check-rule-drift.ts`).
  Each row names an anchor, the reference that owns it, and the summaries that must restate it
  verbatim. Editing a rule in one place and not the others now fails the build.
- **An `allowed-tools` coverage check.** Every command in a `` ```bash `` fence must be a shell
  builtin or covered by the skill's own grant, a grant no command uses is reported, and a command
  line opening with `VAR=value` is rejected with the reason.
- **Non-markdown reference resolution** for the paths this generator owns (`references/`,
  `scripts/`, `assets/`, `.claude/`, `.agents/`, `.github/`), so a skill can no longer point at a
  script that does not exist.
- **Frontmatter key allowlist and a block-scalar guard.** `description: >` used to be stored as the
  literal `">"` with its continuation lines silently dropped.
- `skills/core/conventions.md` — the MUST / SHOULD / WON'T rules, now always installed.
- A tag taxonomy with `@destructive` defined by consequence (state another test can observe), and
  its consequence: own pass, serial, retries off.
- The contract-versus-runtime rule for API tests, coverage of every documented status code, the
  feedback-locator rule for form page objects, and counting the tests that did not run.
- CI: a pruned `--platforms claude --packs core` install, validated and drift-checked.

### Fixed

- **`init --packs core` shipped a skill with no rules.** The MUST / SHOULD / WON'T list lived in
  `project-conventions.md`, in the optional `templates` pack, while the Cursor rule and the Copilot
  instructions restated a subset of it unconditionally. Claude and `.agents` got nothing; Cursor and
  Copilot cited a constitution that was never installed.
- **The three rule summaries had drifted.** Cursor had lost the `afterEach` cleanup rule and the
  `page.evaluate()` ban that Copilot still carried; the pointer block's wording no longer matched
  the rules; both mirrors listed a four-rung selector ladder where the reference that owns it lists
  five, dropping `getByPlaceholder` and `getByAltText`.
- **A core reference ordered a script that is never generated** (`node scripts/run-5x.mjs 5`),
  replaced with a loop that uses only shell builtins.
- **A debugging command could never be permitted.** `PLAYWRIGHT_HTML_OPEN=never npx playwright test`
  puts an assignment in first position, where no `Bash(npx playwright:*)` grant can match it.

### Changed

- `skills/templates/project-conventions.md` keeps only the project-specific layer and points at
  `conventions.md` for the shared rules.


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

### Merged from 1.3.0

- `api-testing-patterns.md` and `pass-rate-and-flake-analysis.md` (added on main in 1.3.0) are carried
  forward, wired into the new index, and cross-linked with `ci-and-flake-triage.md` so their scopes do
  not overlap. They needed no generator change: reference files are now discovered by reading the pack
  directory.

### Fixed

- Cursor and Copilot output wrapped an already-frontmattered file in a second frontmatter block and dropped every linked reference.
- Generic output linked sibling files that were written under `references/`.
- `--debug=cli` was described as printing each step; it pauses the test for `playwright-cli attach`. `browser.bind()` was called without its required name and treated as a URL. `snapshot --selector` does not exist; trace commands use `--phase`, not `--name`. `test-reports/` is `test-results/`.
- The custom-fixture spec template imported `test` but used `expect`; `goto` hardcoded the base URL; tags were in titles instead of `{ tag: [...] }`.
- Contradictory guidance: trace "off on CI" vs `on-first-retry`; 3-tier vs 5-tier selector ladder; `frameLocator` listed as a selector priority; undeclared `request` and `UserSchema` in examples; Cursor rule without `alwaysApply` and with quoted globs.
- Confirm prompts default to a safe answer; cancelling exits non-zero; `plan()` errors are reported instead of crashing.

## 1.3.0

- `api-testing-patterns` and `pass-rate-and-flake-analysis` core references.

## 1.2.0

- Guardrails, tests, CI, dependency updates.

## 1.1.0

- Playwright 1.59 agent debugger content and vendored `playwright-cli` skill.

## 1.0.0

- Initial release.
