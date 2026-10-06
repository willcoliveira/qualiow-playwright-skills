---
id: playwright-test
title: Write a test from a plan
summary: Apply an accepted plan — spec, page objects and fixtures — then verify by running it repeatedly.
argument-hint: "<accepted plan, or the feature it covers>"
allowed-tools: "Bash(playwright-cli:*), Bash(npx playwright:*), Read, Write, Edit, Glob, Grep"
---

# Write a test from a plan

Phases 6 to 8 of `../references/workflow.md`.

## Before starting

**Refuse to start without exploration evidence.** One of these must be true, and say which:

- the page was snapshotted in this session, or
- a page object already covers this flow and you have read it

If neither holds, run the planning workflow first. Writing a spec against selectors nobody has
resolved is the most expensive thing that can happen here, because it fails in CI rather than now.

## Apply

Write only what the plan named. Follow `../references/conventions.md`; it is the list a review holds
this against. In particular:

- `test` and `expect` come from the project fixtures file, not from `@playwright/test`
- locators are readonly properties on a page object, and action methods are wrapped in `test.step()`
- a page object for a form exposes success, error and field-validation locators, or it is not
  finished{{#if HAS_TEMPLATES}} — see `../references/page-object-conventions.md`{{/if}}
- one selection tag, in the options object, never in the title
- web-first assertions only; no `page.waitForTimeout()`, no `{ force: true }`, no `networkidle`

A change you find you need that the plan did not name is a new plan. Say so and stop — do not add it
quietly.

## Check every locator you composed

Before running anything, count each locator you wrote by hand — a chain, a `filter()`, a component
scoped to a root — against the live page, in the state the test reaches:

```bash
playwright-cli run-code "async page => await page.getByRole('row', { name: 'Invoice 1042' }).getByRole('button', { name: 'Delete' }).count()"
```

It must print 1 for anything the test acts on. A locator taken straight from `generate-locator` has
already been resolved; one you assembled has not, and the first run to find out is otherwise CI. The
fallback when `run-code` is unavailable is in `../references/locators-and-assertions.md`.

## Verify

Confirm the filter selects what you mean, then run it with retries off:

```bash
npx playwright test src/tests/checkout.spec.ts -g "submits an order" --list
npx playwright test src/tests/checkout.spec.ts -g "submits an order" --repeat-each=3 --retries=0
```

`--list` runs nothing; it shows whether `-g` also caught a sibling test or a second project. If the
project runs Playwright through an npm script, flags go after `--`
(`../references/ci-and-flake-triage.md`).

Three clean runs are the minimum before saying the test works — and all they show is that it is not
broken. They miss a test that fails half the time once in eight tries. To call it stable, or for
anything that talks to a network, size the run count from `../references/pass-rate-and-flake-analysis.md`.

If it fails, fix the cause. **Never** make it pass by raising a timeout, adding a retry, weakening
an assertion, or inserting a wait before an action that already auto-waits.

## Watch it fail

A test you have only seen pass has not been shown to test anything. Make it fail once, on purpose,
for the reason it exists:

1. Break the assertion that carries the case — change the expected total, the confirmation text, the
   URL pattern — or feed the action an input that must be rejected.
2. Run it once. It must fail **at that assertion**, with a message naming what you changed. Failing
   somewhere else, or timing out earlier, does not count.
3. Revert, and run it green again.

If it stays green with the assertion broken, the assertion is not connected to the behaviour — an
absence check with no presence anchor, a value read from the wrong copy, a helper that swallows the
failure. Fix that before anything else. Never commit the mutated version.

## Report

Write it as markdown a reviewer can paste into the PR: what was added, the commands you ran, how many
times it passed out of how many, what you changed to watch it fail and where it failed, and what is
still unverified. If a case in the plan was not implemented, name it — a report that silently covers
four of five cases reads as complete.
