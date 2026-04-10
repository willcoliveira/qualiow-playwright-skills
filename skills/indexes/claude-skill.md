# Playwright E2E Skills

## Decision Tree

```
What do you need to do?
│
├─ Write a NEW test
│  ├─ Plan first        → references/test-planning.md
│  ├─ Generate code     → references/test-generation.md
│  └─ Review when done  → references/test-review.md
│
├─ Debug a FAILING test
{{#if HAS_PLAYWRIGHT_159}}│  ├─ Agent debug (CLI) → references/test-debugging.md (uses --debug=cli + trace analysis)
{{/if}}│  └─ Diagnose & fix    → references/test-debugging.md
│
├─ Understand PATTERNS
│  ├─ Playwright APIs   → references/playwright-patterns.md
│  ├─ Test data         → references/data-strategy.md
│  └─ Page objects      → references/page-object-conventions.md
│
├─ Follow CONVENTIONS
│  └─ MUST/SHOULD/WON'T → references/project-conventions.md
│
└─ Use PLAYWRIGHT CLI
   └─ Browser automation → ../playwright-cli/SKILL.md
```

## Quick Reference

- **Before writing tests:** Read `test-planning.md` → explore with playwright-cli → write using `test-generation.md`
- **Before submitting PRs:** Run `test-review.md` checklist
{{#if HAS_PLAYWRIGHT_159}}- **When tests fail:** Follow `test-debugging.md` workflow → use `--debug=cli` + trace analysis → classify root cause → fix or report bug{{/if}}
{{#if NO_PLAYWRIGHT_159}}- **When tests fail:** Follow `test-debugging.md` workflow → classify root cause → fix or report bug{{/if}}
- **For patterns:** Check `playwright-patterns.md` for waitForResponse, toPass, expect.poll
