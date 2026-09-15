---
id: playwright-review
title: Review test code
summary: Run the review checklist over changed test files, mechanical checks first, judgement second.
argument-hint: "[paths or a git range]"
allowed-tools: "Bash(npx playwright:*), Read, Glob, Grep"
---

# Review test code

The checklist in `references/test-review.md`, run in an order that spends attention where it counts.

## 1. Scope the review

Review what changed, not everything. Use a three-dot range against the base branch so you see the
author's changes and not commits that merely landed on the base since — findings against code they
never wrote are noise that costs the review its credibility.

## 2. Mechanical pass

These are grep-findable and take no judgement. Do them first and in bulk, so the expensive pass is
not spent on them:

| Look for | Category |
| --- | --- |
| `page.waitForTimeout(` | Timing |
| `{ force: true }` | Selectors |
| `xpath=` or `locator('//` | Selectors |
| `networkidle` | Timing |
| `test.only(` or a bare `test.skip()` | Reliability |
| `page.evaluate(` used instead of a locator | Selectors |
| A spec file over 300 lines | Readability |
| A test with no `expect` | Assertions |

## 3. Judgement pass

Only now, and only on what the mechanical pass could not answer:

- **Do the assertions mean anything?** A test that asserts a page loaded proves nothing about the
  feature. This is the finding that matters most and the one a grep will never make.
- **Is it isolated?** Would it pass if it ran second, or in parallel with its sibling? Does it clean
  up state another test can observe — and if it mutates shared state, is it tagged `@destructive`?
- **Does the page object report outcomes?** A form page object with no success, error or validation
  locator produces tests that can only assert that a click did not throw.
- **Coverage.** What does the change not cover that the cases next to it do? A missing negative case
  is a finding.

## 4. Report

Use the existing format: CRITICAL, WARNING, INFO, each with the file, the line and the fix. When a
finding sits between two levels, go one level lower — an inflated severity gets the whole report
discounted, and an understated one still gets read.

Say what you did not check. A review that lists eleven findings and does not say it skipped the
fixtures reads as complete.
