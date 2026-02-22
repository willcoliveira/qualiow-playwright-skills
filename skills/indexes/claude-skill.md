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
│  └─ Diagnose & fix    → references/test-debugging.md
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
- **When tests fail:** Follow `test-debugging.md` workflow → classify root cause → fix or report bug
- **For patterns:** Check `playwright-patterns.md` for waitForResponse, toPass, expect.poll
