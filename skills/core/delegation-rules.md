# What can be delegated, and what cannot

Some of the work here is finding things: which specs touch a route, what is on a page, which tests
failed and where. That work is expensive in context and cheap in judgement, and handing it to a
smaller model or a separate pass costs nothing.

The rest is judgement, and it is the reason a person asked for this at all.

## The rule

**Delegate the I/O. Keep the reasoning.**

A delegated task answers **where** or **what is there**. It never answers **whether**.

Ask one question before handing anything off: *is the answer determined by the input, or is it an
opinion about the input?* Reading sixty spec files to list which ones import a page object is
determined. Deciding whether that coverage is adequate is an opinion. The first is delegable and
the second is the work.

## Never delegate

- **Whether something is a bug**, and whether it is an application bug or a test bug
- **Severity, priority or risk** of any finding
- **Whether a suite is stable enough to ship**
- **What is missing** — from coverage, from a page object, from a plan. Absence is the hardest
  thing to see and the least mechanical
- **The confidence score** and the decision to emit or withhold a plan
- **The summary or the recommendation** in any report

A delegate that returns one of these has exceeded its brief. Discard that part of its answer rather
than working from it — not because it will always be wrong, but because you cannot tell from the
output whether it was reasoned or guessed, and it will read as authoritative either way.

## What a good delegated task looks like

It names the artifact it must return, bounds its size, and forbids the verbs that would turn it
into an opinion. "Return one row per spec with its tags and the routes it touches, at most eighty
rows, and write nothing about whether the coverage is sufficient" is a task. "Review the suite" is
not — it is the job, handed off.

{{#if HAS_WORKFLOWS}}The four agents installed with the `workflows` pack are written this way:
`pw-suite-indexer`, `pw-page-mapper`, `pw-failure-indexer` and `pw-review-scanner` each return one
named artifact and each carries a Forbidden section. They exist on Claude Code and nowhere else,
which is safe precisely because of the rule above: they return artifacts rather than verdicts, so
doing the same work inline produces the same artifact and the other platforms lose only the context
saving.{{else}}This applies to any hand-off — a sub-agent, a second pass, or a colleague. The
constraint is the same: name the artifact, bound it, and keep the judgement.{{/if}}
