---
id: playwright-test
title: Write a test from a plan
summary: Apply an accepted plan — spec, page objects and fixtures — then verify by running it repeatedly.
argument-hint: "<accepted plan, or the feature it covers>"
allowed-tools: "Bash(playwright-cli:*), Bash(npx playwright:*), Read, Write, Edit, Glob, Grep"
---

# Write a test from a plan

Phases 6 to 8 of `references/workflow.md`.

## Before starting

**Refuse to start without exploration evidence.** One of these must be true, and say which:

- the page was snapshotted in this session, or
- a page object already covers this flow and you have read it

If neither holds, run the planning workflow first. Writing a spec against selectors nobody has
resolved is the most expensive thing that can happen here, because it fails in CI rather than now.

## Apply

Write only what the plan named. Follow `references/conventions.md`; it is the list a review holds
this against. In particular:

- `test` and `expect` come from the project fixtures file, not from `@playwright/test`
- locators are readonly properties on a page object, and action methods are wrapped in `test.step()`
- a page object for a form exposes success, error and field-validation locators, or it is not
  finished — see `references/page-object-conventions.md`
- one selection tag, in the options object, never in the title
- web-first assertions only; no `page.waitForTimeout()`, no `{ force: true }`, no `networkidle`

A change you find you need that the plan did not name is a new plan. Say so and stop — do not add it
quietly.

## Verify

```bash
npx playwright test src/tests/checkout.spec.ts -g "submits an order" --repeat-each 3
```

One green run is a single sample. Three consecutive is the minimum before saying it works, and for
anything that talks to a network see `references/pass-rate-and-flake-analysis.md`.

If it fails, fix the cause. **Never** make it pass by raising a timeout, adding a retry, weakening
an assertion, or inserting a wait before an action that already auto-waits.

## Report

What was added, what you ran, how many times it passed, and what is still unverified. If a case in
the plan was not implemented, name it — a report that silently covers four of five cases reads as
complete.
