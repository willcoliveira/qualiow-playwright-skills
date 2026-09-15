# Operating Procedure

How to work on this suite, in order. The phases are cheap to follow and expensive to skip: almost
every bad test in a Playwright repository comes from generating before exploring, and almost every
wasted review cycle comes from applying before agreeing.

Say which phase you are in. It costs one line and it is the only way the person reading along can
tell whether you are still gathering or already committing.

## The phases

**1 — Classify.** Name the job out loud, as one of: new test, failing test, review, determinism
check, API contract. If it is none of them, say so and ask. A misclassified job reads the wrong
reference and produces plausible work on the wrong problem.

**2 — Route.** Name the reference you are about to read before reading it. The index in `../SKILL.md`
maps each job to one. Reading the wrong reference is the most common failure here, and naming it
first is what makes it visible.

**3 — Explore.** Gather evidence about the thing itself, not about code that describes it.

- New test: open the page with `playwright-cli`, take a snapshot, and get every selector from
  `generate-locator` or from a page object that already covers the flow.
- Failing test: reproduce it first. Run the single test by file and title before touching anything.
  A failure you have not seen is a failure you cannot fix.
- API work: read the documented contract — the OpenAPI document, the schema, the ticket. Not the
  live response.

**4 — Plan, with a confidence score.** Emit the proposal shape below. Nothing is written yet.

**5 — Stop before applying.** The plan is for a person. Wait for approval. If it is rejected, go
back to phase 3 and gather what was missing; do not re-emit the same plan in different words.

**6 — Apply.** Edit only what phase 4 named. A change you discover you need mid-apply is a new
plan, not a silent addition.

**7 — Verify.** Run the tests you touched, more than once:

```bash
npx playwright test src/tests/checkout.spec.ts -g "submits an order" --repeat-each 3
```

One green run is not verification — it is one sample from a distribution you have not measured. For
anything that talks to a network, see `pass-rate-and-flake-analysis.md`. Never make a test pass by
raising a timeout, adding a retry, or weakening an assertion.

**8 — Report.** What changed, what you ran to verify it, and what is still unknown. The unknowns
are the part with value; a report without them is a claim, not a result.

## The confidence gate

Every phase-4 proposal has this shape:

```
Scope:       <files, and what changes in each>
Trade-offs:  <what this gives up, or "none">
Confidence:  <1-10>
Rationale:   <one line per factor, for and against>
Unknowns:    <one line per assumption, or "none">
```

The score is not a mood. It is anchored:

- **9-10** — the behaviour is named in a spec, ticket or contract; the page or endpoint was opened
  and snapshotted *in this session*; every selector came from `generate-locator` or an existing page
  object; no new environment variable, credential or fixture is required.
- **5-8** — the flow is understood, but at least one selector, fixture or data prerequisite is
  assumed. Emit the plan **with those assumptions listed as Unknowns**, one per line.
- **Below 5, emit no plan.** You have not opened the page, or you have not reproduced the failure.
  A low score is not a disclaimer to attach to a proposal — it means you are still in phase 3. Ask
  the questions that would raise it.

A rejected plan returns to phase 3. Rewording a rejected plan and presenting it again wastes the
reviewer's second read and produces the same objection.

## Direct Mode

Trivial work — a typo, a single import, a renamed constant — skips phases 3 to 5. One rule survives:

**Verify the premise.** Before fixing the thing you were told is broken, open the file and confirm
it is broken in the way described. If the locator they named is not there, or already reads the way
they asked for, stop and say so. Fixing a defect that is not present leaves the real one in place
and the report says it was handled.

## What not to invent

**Explore before generate.** A locator that was never resolved against a real page is a guess with
good syntax. It will pass review, fail in CI, and cost more to diagnose than writing it properly
would have cost.

**A skeleton counts as a placeholder.** `TODO`, "fill in the selectors later", a page object with
empty methods, a test with a commented-out assertion — all of these are the same move as inventing
the locator outright, with the failure deferred. Placeholders are not deliverables. If you cannot
finish it, say what is blocking and stop.

**No substitute exploration.** If `playwright-cli` is not available, **stop and say so**. Do not
read the application source and infer selectors from the markup, do not guess from screenshots, and
do not fall back to `page.$$eval`. Inferred selectors are the single largest source of tests that
pass once and never again.

**Never invent a credential, a token or an environment variable** to make a run go green. A missing
environment variable is a setup problem to report, not a branch defect to work around.

## Related

- `conventions.md` — the MUST / SHOULD / WON'T rules every change is held to
- `test-review.md` — the checklist phase 7 hands off to
- `pass-rate-and-flake-analysis.md` — what verification means for a suite that talks to a network
