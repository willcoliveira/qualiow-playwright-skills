---
name: playwright-e2e
description: "Playwright end-to-end testing skills for {{PROJECT_NAME}}: plan, generate, review and debug tests with page objects, web-first assertions, fixtures and a test data strategy. Use when writing, fixing or reviewing Playwright tests, page objects, fixtures or playwright.config."
allowed-tools: "Bash(playwright-cli:*), Bash(npx playwright:*), Read, Write, Edit, Glob, Grep"
---

# Playwright E2E Skills

## Decision Tree

```
What do you need to do?
│
├─ Write a NEW test
{{#if HAS_TEMPLATES}}│  ├─ Plan first        → references/test-planning.md
│  ├─ Generate code     → references/test-generation.md
{{/if}}│  ├─ Locators/asserts  → references/locators-and-assertions.md
│  └─ Review when done  → references/test-review.md
│
├─ Debug a FAILING test
{{#if HAS_TEMPLATES}}│  ├─ Diagnose & fix    → references/test-debugging.md
{{/if}}│  ├─ Agent debugging   → references/agent-debugging.md
│  └─ Flaky on CI       → references/ci-and-flake-triage.md
│
├─ Test an API (no browser)
│  └─ Request context   → references/api-testing-patterns.md
│
├─ Prove DETERMINISM
│  └─ Run it N times    → references/pass-rate-and-flake-analysis.md
│
├─ Understand PATTERNS
│  ├─ Playwright APIs   → references/playwright-patterns.md
│  ├─ Fixtures & auth   → references/fixtures-and-auth.md
{{#if HAS_TEMPLATES}}│  ├─ Page objects      → references/page-object-conventions.md
{{/if}}│  └─ Test data         → references/data-strategy.md
│
├─ Follow CONVENTIONS
│  ├─ MUST/SHOULD/WON'T → references/conventions.md
{{#if HAS_TEMPLATES}}│  └─ This project's rules → references/project-conventions.md
{{/if}}│
└─ Automate a BROWSER   → official `playwright-cli` skill (see below)
```

## Skill Reference

| Reference | When to use |
|-----------|-------------|
| `references/playwright-patterns.md` | waitForResponse, toPass, expect.poll, network-first safeguards |
| `references/api-testing-patterns.md` | Testing a service over HTTP with no browser: `APIRequestContext`, per-call credentials, schema contracts, bounded polling, delta assertions, request budgets |
| `references/locators-and-assertions.md` | Strict mode, locator composition, soft assertions, aria snapshots, visual comparison, mocking in tests, clock |
| `references/fixtures-and-auth.md` | Custom fixtures with `base.extend`, worker scope, auth via setup projects and `storageState` |
| `references/data-strategy.md` | Choosing between static data and dynamic factories |
| `references/conventions.md` | The MUST / SHOULD / WON'T rules every test follows |
| `references/test-review.md` | 7-category review checklist, quality gates, severity levels |
| `references/ci-and-flake-triage.md` | Retries, sharding, reporters, `describe.configure`, `test.fail/fixme/slow`, flake triage |
| `references/pass-rate-and-flake-analysis.md` | Proving determinism by running the suite N times: the four outcomes, per-test stability, what to report |
| `references/agent-debugging.md` | `--debug=cli` + `playwright-cli attach`, trace triage from the terminal |
{{#if HAS_TEMPLATES}}| `references/page-object-conventions.md` | POM structure, selectors, component composition |
| `references/project-conventions.md` | This project's own rules, file organization, CI conventions |
| `references/test-debugging.md` | Failure patterns, root cause classification, decision tree |
| `references/test-generation.md` | Test scaffolding templates, import rules, fixture docs |
| `references/test-planning.md` | Exploration workflow, test plan template, planning checklist |
{{/if}}

## Browser automation and agent debugging

Playwright ships its own agent skills; this skill does not duplicate them.

- **`playwright-cli`** drives a browser from the terminal (`open`, `snapshot`, `click`, `fill`, `find`, `eval`, `generate-locator`, `attach`). Install into this project with `npx playwright cli install --skills` (Playwright 1.62+) or `npm i -g @playwright/cli@latest && playwright-cli install --skills`.
- **`playwright-trace`** inspects `trace.zip` files from the terminal (`npx playwright trace ...`). Install with `npx playwright trace install-skill`.
- The workflow that ties them together (`npx playwright test --debug=cli`, `playwright-cli attach`, trace triage) is in `references/agent-debugging.md`.

## Quick Reference

- **Before writing tests:** {{#if HAS_TEMPLATES}}read `references/test-planning.md`, explore the page (playwright-cli if installed), then write using `references/test-generation.md`{{else}}explore the page (playwright-cli if installed), then write using the patterns in `references/locators-and-assertions.md` and `references/fixtures-and-auth.md`{{/if}}
- **Before submitting PRs:** run the `references/test-review.md` checklist
- **When tests fail:** {{#if HAS_TEMPLATES}}follow `references/test-debugging.md`, {{/if}}{{#if HAS_PLAYWRIGHT_159}}attach with `--debug=cli` (`references/agent-debugging.md`), {{/if}}classify the root cause, then fix the test or report the app bug
- **For patterns:** check `references/playwright-patterns.md` for waitForResponse, toPass, expect.poll
- **Before calling a suite stable:** run it N times and report the distribution (`references/pass-rate-and-flake-analysis.md`), never a single green run
