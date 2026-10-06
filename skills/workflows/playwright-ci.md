---
id: playwright-ci
title: Get a pull request's CI to green
summary: Read the failed CI log, sort the failure into this PR's code, a stale base or infrastructure, and fix it or hand it to a person — never retry, skip or merge your way to green.
argument-hint: "[PR number or branch, default the current branch]"
allowed-tools: "Bash(gh pr checks:*), Bash(gh pr view:*), Bash(gh run view:*), Bash(gh run rerun:*), Bash(gh run download:*), Bash(git fetch:*), Bash(git diff:*), Bash(git merge-base:*), Bash(npx playwright:*), Read, Write, Edit, Glob, Grep"
---

# Get a pull request's CI to green

The job ends in one of two states: the checks are green because the cause was fixed, or a person
has a short report that tells them exactly what they have to decide. A green tick bought any other
way is a defect that has not been reported yet.

## 1. Read the failure before touching anything

```bash
gh pr checks 482
gh pr view 482 --json baseRefName,headRefName,files
gh run view 9187234411 --log-failed
```

The run id is in each failing check's link (`…/actions/runs/<run-id>/job/…`). Read the log of every
failing job, not the first one. Write down, per failure: the job, the step, the test title if there
is one, and the first error line quoted verbatim.

Do not open an editor, push a commit or press rerun until this list exists. A failure you have not
read is a failure you are guessing at.

## 2. Sort each failure into one bucket

| The failure is in… | How you know | What happens next |
| --- | --- | --- |
| **Code this PR touched** | The failing test, or the code it exercises, is in the PR's diff | Step 3 |
| **Code this PR did not touch** | Nothing in the diff is on the failing path | Step 4, before anything else |
| **Infrastructure** | It failed before or around the tests: runner lost, install or browser download failed, registry or network unreachable, the job was killed or hit its own time limit | Step 5 |

```bash
git fetch origin main
git diff --name-only origin/main...HEAD
```

Use the base branch `gh pr view` reported; `main` here is an example.

The three-dot range is the PR's own change. Commits that landed on the base since the branch was cut
are not in it, and they are exactly what step 4 is looking for.

If a failure fits none of the three, or fits two, it goes in the report as unclassified with the
evidence you have. Do not force it into the bucket with the cheapest fix.

## 3. Code the PR touched: fix it

This is a test failure like any other — follow `playwright-debug.md`. Reproduce it locally first,
with the CI run's project and without retries:

```bash
npx playwright test src/tests/checkout.spec.ts -g "submits an order" --project=chromium --retries=0
```

If it passes locally, that is a finding, not a pass: the difference between this machine and the
runner is the thing to explain, and `../references/ci-and-flake-triage.md` lists the usual ones.

When the evidence says the application is wrong rather than the test, stop. That is the
APPLICATION_BUG outcome of the debug procedure: the test stays red and the report is the
deliverable.

## 4. Code the PR did not touch: check the base first

The most common reason a PR fails in code it never changed is that the branch is behind its base,
and the fix already landed there.

```bash
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
```

Exit status 0 means the branch already contains the latest base, and 1 means it is stale. Any other
status is an error — usually a ref that was not fetched — not an answer.

- **Stale.** Bring the branch up to date the way the repository does it — merge the base in, or
  rebase onto it — then push to the PR branch and let CI run again. A rebase needs a force push to
  the PR branch: ask before doing that, even when you are confident.
- **Up to date, and the same test fails on the base branch too.** It is not this PR's failure.
  Report it with the base run's link and stop; fixing someone else's break inside this PR hides it
  in an unrelated diff.
- **Up to date, and the base is green.** The PR changed something the test depends on without
  touching the test — shared data, a fixture, a config value, a route. Treat it as step 3.

## 5. Infrastructure: exactly one rerun

```bash
gh run rerun 9187234411 --failed
```

One. If it fails again, compare the two attempts:

```bash
gh run view 9187234411 --attempt 1 --log-failed
gh run view 9187234411 --attempt 2 --log-failed
```

**The same failure twice is not a flake.** Same step, same test, same first error line means the
cause is deterministic and the rerun only cost ten minutes to prove it — move it to step 3 or 4.
A second, different infrastructure failure goes in the report for a person; a third attempt is not
yours to make.

If the rerun goes green on a test that failed, that is a flaky test, not a fix. Name it in the
report, and point at `playwright-determinism.md` for measuring it — do not let the green run close
the matter.

## 6. Use the artifacts, not only the log

The log says what failed; the report and traces say why.

```bash
gh run download 9187234411 --dir /tmp/ci-9187234411
```

Download outside the working tree. Traces and reports carry typed values, cookies and request
headers — never commit them and never attach them to the PR.

With a JSON report in the artifacts, hand it to the `pw-failure-indexer` sub-agent and work from the
table it returns. With blob reports from sharded jobs, merge them into one JSON report first:

```bash
mkdir -p /tmp/ci-9187234411/blobs
cp /tmp/ci-9187234411/blob-report-*/*.zip /tmp/ci-9187234411/blobs/
npx playwright merge-reports --reporter=json /tmp/ci-9187234411/blobs > /tmp/ci-9187234411/report.json
```

The indexer returns rows, not causes. Which rows share a cause, and which bucket each belongs in, is
your call (`../references/delegation-rules.md`). On a platform without sub-agents, build the same
table yourself from the same files.

If the run uploaded no machine-readable report, say so in the report — a CI that cannot be
diagnosed without rerunning it is a finding of its own.

## Never

- Add `retries`, `test.skip()`, `test.fixme()`, `test.fail()` or a larger timeout to make a check pass.
  Marking a test is a person's decision, made in the open, with a ticket.
- Merge the PR, approve it, or enable auto-merge.
- Push to the base branch, or force-push anywhere without being asked.
- Edit the CI workflow to drop, skip or soften a failing step.
- Press rerun a second time on the same run.

## When to stop and hand off

Stop and report — do not keep trying — when:

- the failure is an application bug, or is on the base branch too
- the rerun failed differently, or it failed the same way and the fix is outside this PR
- the fix needs a decision: a product behaviour, a test to mark, a force push, a secret or a runner
- you have made two fix attempts on the same failure and it is still red

## Report

```
PR 482 — checks: 2 failing → 0 failing | 1 handed off

checkout.spec.ts › submits an order      touched code     fixed: locator renamed (commit a1b2c3d)
search.spec.ts › filters by price        untouched code   branch was stale; merged main, green
e2e (shard 3/4) › install browsers       infrastructure   rerun once, failed the same way — handed off

Handed off: shard 3 cannot download browsers on two attempts (log lines quoted below).
Not checked: the html-report artifact for shard 1 was not uploaded.
```

One line per failure, with its bucket, what you did and what is true now. Say what you did not
check. "CI is green" without the list says nothing about how it got there.
