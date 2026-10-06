---
id: playwright-determinism
title: Prove a suite is deterministic
summary: Run a suite N times, keep every result, and report the distribution rather than the last run.
argument-hint: "[N, default 5] [test path]"
allowed-tools: "Bash(npx playwright:*), Read, Glob, Grep"
---

# Prove a suite is deterministic

The procedure in `../references/pass-rate-and-flake-analysis.md`. The point is to replace an assertion
with a measurement.

## 1. Run it N times and keep every run

```bash
mkdir -p runs
for i in 1 2 3 4 5; do
  npx playwright test --reporter=json > /dev/null 2>&1 || true
  cp test-results/results.json "runs/run-$i.json"
done
```

Five is the floor, not the target. Five clean runs of a test bound its failure rate only below
about 60% — at 95% confidence, zero failures in *n* runs means a rate under roughly 3/*n*. Size *N*
to the claim you intend to make (`../references/pass-rate-and-flake-analysis.md` has the table).
`|| true` matters: a failing run is the data, not a reason to stop the loop.

## 2. Classify every result

Read each report and count the outcomes separately — passed, known defect still reproducing, real
failure, defect no longer reproducing, flaky. Collapsing them into a percentage throws away the
distinction the exercise exists to preserve. A suite that is green because six defects still
reproduce is not the same claim as one where everything works.

Count the tests that did not run as their own number, never inside the pass rate.

## 3. Name every test that was not identical every time

Stability is per test, not per run. Five green runs can hide a test that passed for a different
reason each time. List any test whose outcome varied, with the outcomes it produced.

## 4. Report a distribution

Write it as markdown a reviewer can paste into a PR unchanged — on GitHub Actions, append the same
text to the file `$GITHUB_STEP_SUMMARY` names and it renders on the run page:

```markdown
**5 runs × 47 tests**

| Outcome | Count |
| --- | ---: |
| Passed | 225 |
| Known bug still reproduces | 10 |
| Failed | 0 |
| Flaky | 5 |
| Did not run | 0 |

1 test did not produce the same outcome every run:

- `checkout.spec.ts › applies the promo code` — passed, passed, flaky, passed, flaky
```

Never report "the suite passes". Report what happened, how many times, and which tests moved.

**A suite that needs retries to be green is not deterministic.** Say that plainly — retries are a
safety net for infrastructure, not a strategy for a race, and a green number bought with them tells
the next person something untrue.
