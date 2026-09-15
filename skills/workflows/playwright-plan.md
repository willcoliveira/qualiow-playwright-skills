---
id: playwright-plan
title: Plan a new test
summary: Explore the feature and produce a test plan with a confidence score. Writes no test code.
argument-hint: "<feature description or URL>"
allowed-tools: "Bash(playwright-cli:*), Bash(npx playwright:*), Read, Glob, Grep"
---

# Plan a new test

Phases 1 to 5 of `../references/workflow.md`. This produces a plan and stops. It does not write a test,
a page object, or a fixture.

## 1. Understand what is being asked

Restate the feature in one sentence. If the request names a page, a URL or a ticket, say which.
If it names none of them, ask — do not pick a page that looks related.

## 2. Find out what already exists

Before exploring the application, look at the suite. A new test that duplicates an existing one is
worse than no test: it doubles the maintenance and splits the signal when it fails.

- Specs covering this area, and what they already assert
- Page objects covering these pages, and which locators they already expose
- Fixtures that already set up the state this flow needs

## 3. Explore the real thing

Open the page and take a snapshot. Every selector in the plan comes from `generate-locator` or from
a page object that already exists — never from reading application source.

```bash
playwright-cli open https://example.com/checkout
playwright-cli snapshot
playwright-cli generate-locator e34
```

If `playwright-cli` is not available, **stop and say so.** Do not infer selectors from the markup,
from screenshots, or from a component library's conventions. A plan built on inferred selectors
looks complete and produces tests that pass once.

## 4. Write the plan

```
Scope:       <files to add or change, and what changes in each>
Trade-offs:  <what this gives up, or "none">
Confidence:  <1-10>
Rationale:   <one line per factor, for and against>
Unknowns:    <one line per assumption, or "none">
```

Then the cases, each as one line: what the user does, what should happen, and how the test will
know. A case whose third column is "the page loads" is not a case yet.

Mark which cases are in scope now and which are deliberately deferred. A deferred case named is a
decision; a deferred case unnamed is a gap.

## 5. Stop

Do not write code. Wait for a person to accept, change or reject the plan.

**Below confidence 5, emit no plan at all.** That score means the page was never opened or the
requirement is not pinned down. Ask the questions that would raise it instead — a plan at
confidence 3 wastes the reviewer's time and yours.

If the plan is rejected, return to step 2 or 3 and gather what was missing. Do not re-send the same
plan with different wording.
