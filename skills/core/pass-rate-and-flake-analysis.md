# Pass Rate and Flake Analysis

How to prove a suite is deterministic instead of asserting it, and what to write when it is not.
For the CI configuration that produces the runs (sharding, reporters, retries, marking known
failures), see `ci-and-flake-triage.md`.

## Prove it by running it

One green run proves nothing about a suite that talks to a real network. Run it N times
consecutively, keep every run's raw output, and report the distribution.

```bash
node scripts/run-5x.mjs 5
```

The script runs the suite N times, copies `test-results/results.json` to `runs/run-N.json` after
each, and writes a summary. **Copy the file rather than relying on an environment variable to
redirect the reporter** — that precedence has changed between Playwright versions and the failure
is silent.

## Four outcomes, not two

Playwright's JSON reporter gives each test a `status` and an `expectedStatus`. Collapsing them into
passed and failed throws away the distinction that matters most.

| `status` | `expectedStatus` | Meaning | Counts as |
| --- | --- | --- | --- |
| `expected` | `passed` | Passed, as intended | **Passed** |
| `expected` | `failed` | A known defect still reproduces | **Known bug** |
| `unexpected` | `passed` | A real failure | **Failed** |
| `unexpected` | `failed` | A known defect no longer reproduces | **Fixed — go and look** |
| `flaky` | any | Passed on retry | **Flaky** |

A suite that is green because six defects still reproduce is not the same claim as a suite where
everything works. Report them in separate columns or the number is misleading, and the person
reading it will draw the wrong conclusion at exactly the wrong moment.

## Stability is per test, not per run

Five green runs can still hide a test that passed for a different reason each time. Record every
test's outcome across all runs and name any whose outcome varied:

```javascript
const unstable = [...outcomes.entries()].filter(([, o]) => new Set(o).size > 1)
```

That list, not the aggregate, is the honest answer to "is this deterministic".

## The table

| Run | Passed | Known bugs | Unexpected | Flaky | Duration |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1–5 | … | … | 0 | 0 | … |

Follow it with one sentence per unstable test, or the sentence "every test produced an identical
outcome in all five runs, including the known-bug tests, which failed every time".

## Classifying a failure that only sometimes happens

Ask in this order, and stop at the first yes.

1. **Is the system under test actually broken?** Run the failing case alone, in a loop, in
   isolation. A race in the product looks exactly like a race in the tests, and the product is the
   more consequential explanation — check it first, not last.
2. **Are the tests interfering with each other?** Shared identities, shared configuration, shared
   state. Parallel workers turn any shared resource into a race. If the interference is caused by a
   *defect* in the system, that is a finding about the product, and the workaround belongs in the
   harness with the defect id written next to it.
3. **Is a wait unanchored?** A sleep, or a poll whose budget was derived from nothing.
4. **Is it the network?** Real, but the least common answer and the most popular one. Only accept
   it with evidence.

## Do not paper over it

`retries: 0` on anything that asserts on money or correctness. A retry converts a real race into a
green tick and the information is gone. If a suite needs retries to be green, the honest report is
"this suite is not yet deterministic, here is the test and here is what I think causes it".

Quarantine, when you must, with an owner and a date. Never `skip`: a skipped test stops telling you
anything at all, including the day the underlying problem is fixed.

## What to write when the network really is at fault

Say which run, which test, what the error was, and what the budget was. Then say what you changed —
a larger budget with the arithmetic behind it, or a poll where there was a single-shot assertion.
"Flaky, retried" is not an explanation, and a reader who has seen that phrase twice stops trusting
the rest of the report.
