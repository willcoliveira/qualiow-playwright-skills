# wico — Playwright Agent Skills

## Decision Tree

```
What do you need to do?
│
├─ Write a NEW test
│  ├─ Plan first        → test-planning.md
│  ├─ Generate code     → test-generation.md
│  └─ Review when done  → test-review.md
│
├─ Debug a FAILING test
│  └─ Diagnose & fix    → test-debugging.md
│
├─ Understand PATTERNS
│  ├─ Playwright APIs   → playwright-patterns.md
│  ├─ Test data         → data-strategy.md
│  └─ Page objects      → page-object-conventions.md
│
├─ Follow CONVENTIONS
│  └─ MUST/SHOULD/WON'T → project-conventions.md
│
└─ Use PLAYWRIGHT CLI
   └─ Browser automation → playwright-cli/SKILL.md
```

## Skill Reference

| Skill | File | When to Use |
|-------|------|-------------|
| **Playwright Patterns** | `playwright-patterns.md` | waitForResponse, toPass, expect.poll, network-first safeguards |
| **Data Strategy** | `data-strategy.md` | Choosing between static data and dynamic factories |
| **Test Review** | `test-review.md` | 7-category review checklist, quality gates, severity levels |
| **Page Object Conventions** | `page-object-conventions.md` | POM structure, selectors, component composition |
| **Project Conventions** | `project-conventions.md` | MUST/SHOULD/WON'T rules, file organization |
| **Test Debugging** | `test-debugging.md` | Failure patterns, root cause classification, decision tree |
| **Test Generation** | `test-generation.md` | Test scaffolding templates, import rules, fixture docs |
| **Test Planning** | `test-planning.md` | Exploration workflow, test plan template, planning checklist |
| **Playwright CLI** | `playwright-cli/SKILL.md` | Browser automation: open, click, fill, snapshot, trace |
