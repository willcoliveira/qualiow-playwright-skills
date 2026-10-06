# Pass Rate and Flake Analysis

How to prove a suite is deterministic instead of asserting it, and what to write when it is not.
For the CI configuration that produces the runs (sharding, reporters, retries, marking known
failures), see `ci-and-flake-triage.md`.

## Prove it by running it

One green run proves nothing about a suite that talks to a real network. Run it N times
consecutively, keep every run's raw output, and report the distribution.

```bash
mkdir -p runs
for i in 1 2 3 4 5; do
  npx playwright test --reporter=json > /dev/null 2>&1 || true
  cp test-results/results.json "runs/run-$i.json"
done
```

`|| true` keeps the loop going when a run fails — a failing run is data, not a reason to stop.
**Copy the file rather than relying on an environment variable to redirect the reporter** — that
precedence has changed between Playwright versions and the failure is silent, which costs you the
whole run.

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

## Make the build notice

Measuring determinism by hand is what this file is for. Keeping it from regressing is a config line:

<!-- ts-check: wrap-config -->
```typescript
failOnFlakyTests: !!process.env.CI,   // Playwright 1.63+
```

The run exits non-zero when any test passed only on retry. That does not make the suite
deterministic — it makes the loss of determinism arrive as a red build on the day it happens, rather
than as a number somebody notices a quarter later. Keep `retries` where they are: you still want the
artifacts from the retry, you just no longer want the green tick that came with them.

## A test that did not run is not evidence

The four outcomes above describe tests that executed. Every run also produces tests that did not,
and folding those into a percentage is how a suite comes to be described as green when a third of
it never started.

| What happened | Treat it as |
| --- | --- |
| Skipped by a condition (`test.skip(cond, reason)`) | **Not run** — name the condition in the report |
| Skipped unconditionally, or `test.fixme` | **Not run** — and it is a debt, not a result |
| Never started because a setup project or dependency failed | **Blocked** — the cause is the finding, not the count |
| Interrupted when the run was cancelled or sharded off | **Not run** — the sample is incomplete, say so |

Report these as their own number next to the pass rate, never inside it. "142 of 150 passed, 8 not
run" is a result someone can act on. "95%" is not, and it is the same figure.

The same applies to a test that ran and proved nothing — one whose assertion cannot distinguish the
behaviour working from the page never loading. It is not a pass. It is an unverified case wearing a
green tick, and it is worth more to say so than to keep the number tidy.

## Stability is per test, not per run

Five green runs can still hide a test that passed for a different reason each time. Record every
test's outcome across all runs and name any whose outcome varied:

```javascript
const unstable = [...outcomes.entries()].filter(([, o]) => new Set(o).size > 1)
```

That list, not the aggregate, is the honest answer to "is this deterministic".

## Measure a flake before and after, with retries off

A fix for an intermittent failure is a claim that its rate went down, and a claim about a rate needs
a rate on both sides. Before changing anything, run the one test enough times to see it fail, with
retries off so every failure is counted as one:

```bash
npx playwright test tests/checkout.spec.ts -g "pays" --repeat-each=30 --retries=0
```

Write the result down as failures out of runs: 6 of 30. After the fix, run the same command again,
with at least as many repeats. If the measurement before the fix shows no failures, you have not
reproduced it — that is the finding, and a change made now cannot be shown to have done anything.

**Size the run count to the claim.** Zero failures in *n* runs does not mean a rate of zero. At 95%
confidence it means the rate is below roughly **3/n** — the rule of three:

| Clean runs | The rate is below about |
| ---: | ---: |
| 3 | no useful bound |
| 10 | 30% |
| 30 | 10% |
| 100 | 3% |
| 300 | 1% |

Three green runs miss a test that fails half the time once in eight tries (0.5³ = 12.5%), and miss a
one-in-five flake about half the time (0.8³ ≈ 51%). So choose *n* after the fix so that 3/*n* is at
most half the rate you measured before it: a test that failed 6 of 30 times (20%) needs at least 30
clean runs before "fixed" means the rate halved, and more before it means gone. Say the bound in the
report — "0 of 60, so below about 5%" — rather than "it passes now".

A failure that reproduced on every run is a different claim. A handful of green runs shows the
deterministic failure is gone; it says nothing about whether the fix introduced a flake of its own.

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
