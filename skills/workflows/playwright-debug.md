---
id: playwright-debug
title: Debug a failing test
summary: Reproduce the failure, classify its cause from evidence, then fix the test — or report the application bug and leave it failing.
argument-hint: "<test title or spec file>"
allowed-tools: "Bash(playwright-cli:*), Bash(npx playwright:*), Read, Write, Edit, Glob, Grep"
---

# Debug a failing test

The loop in `../references/agent-debugging.md`, with the discipline that makes it produce an answer
rather than a change that happens to go green.

## 1. Reproduce it first

```bash
npx playwright test src/tests/checkout.spec.ts -g "submits an order" --list
npx playwright test src/tests/checkout.spec.ts -g "submits an order" --retries=0
```

`--list` confirms the filter selects the one test you mean before you spend a run on it. If the
project runs Playwright through an npm script, the flags go after `--`
(`../references/ci-and-flake-triage.md`).

A failure you have not seen is a failure you cannot diagnose. If it passes locally, that is the
finding — say so and move to the CI-only path in `../references/ci-and-flake-triage.md` rather than
changing anything.

**If it fails only sometimes, measure the rate before touching anything:**

```bash
npx playwright test src/tests/checkout.spec.ts -g "submits an order" --repeat-each=20 --retries=0
```

Write it down as failures out of runs — 4 of 20. That number is the baseline the fix will be held
against in step 5; without it, "it passes now" cannot be told apart from a lucky streak. Retries stay
off, or a failure a retry rescues is counted as a pass.

## 2. Gather evidence, then classify

Attach to the paused test, or read the trace. Classify against the table in
`../references/agent-debugging.md`: LOCATOR_CHANGED, ELEMENT_REMOVED, NEW_PREREQUISITE, TIMING_ISSUE,
API_FAILURE, APPLICATION_BUG.

State the classification and the evidence for it before touching a file. "The button's accessible
name changed from Submit to Place order, per the snapshot" is a diagnosis. "It seems flaky" is not.

## 3. Fix, according to what it is

| Classification | What to change |
| --- | --- |
| LOCATOR_CHANGED | The page object's locator, to the new accessible name |
| ELEMENT_REMOVED | The test — the flow changed, so the case has to change with it |
| NEW_PREREQUISITE | Setup or a fixture, so the precondition is established rather than assumed |
| TIMING_ISSUE | The assertion, to a web-first one that waits for the real signal |
| API_FAILURE | Nothing in the test until you know whether the service or the environment is at fault |
| APPLICATION_BUG | **Nothing.** See below |

## 4. When it is an application bug, leave it failing

Do not fix the test. Do not skip it. Report it: what the test asserts, what the application does,
and the evidence. Then wrap it as a known defect (`../references/api-testing-patterns.md`) only if a
person decides the suite should be green while the bug is open — that is their call, not yours.

A test quietly adjusted to match broken behaviour removes the only thing that would have caught the
regression, and the report says it was fixed.

## 5. Verify and report

Re-run the same command, `--retries=0` included, with a run count sized to the claim:

- **It failed on every run before.** Three clean runs show the deterministic failure is gone. They
  do not show the fix left no flake behind.
- **It failed some of the time.** Choose *N* so that 3/*N* is at most half the rate you measured in
  step 1 (the rule of three, `../references/pass-rate-and-flake-analysis.md`). At 4 of 20 (20%) that
  is at least 30 clean runs. Three green runs miss a 50% flake one time in eight.

Report as markdown ready for the PR description: the classification and the evidence for it, the
change, and the rate before and after as counts — "4 of 20 before, 0 of 30 after, so below about
10%". If the classification was APPLICATION_BUG, the report is the deliverable and the test is still
red.
