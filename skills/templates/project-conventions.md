# Project Conventions — {{PROJECT_NAME}}

The shared rules live in `conventions.md`: MUST, SHOULD and WON'T, and they apply here unchanged.
This file is the project-specific layer on top of them — the things only someone working on
{{PROJECT_NAME}} can fill in.

Add project rules below rather than restating the shared ones. A rule written twice drifts; a rule
written once and referenced does not.

## Project-Specific Rules

<!-- YOUR PROJECT: Add MUST rules that apply only to this codebase -->
<!-- Example:
- **MUST** use the `createTestUser` fixture for new users, never the signup form
- **MUST** release the reservation in `afterEach` — the inventory is shared across workers
-->

<!-- YOUR PROJECT: Add SHOULD and WON'T rules that apply only to this codebase -->

---

## File Organization Rules

### Test Files

```
{{TEST_DIR}}/{feature}/{feature-name}.spec.ts
```

<!-- YOUR PROJECT: Document your test file organization here -->
<!-- Example:
- Group by feature area first
- Then by scenario type (smoke, regression, etc.)
- One `test.describe()` per file with tags in the describe options (`{ tag: [...] }`)
-->

### Page Objects

```
{{PAGE_OBJECTS_DIR}}/{page-name}.page.ts     # Page objects
{{PAGE_OBJECTS_DIR}}/components/{name}.ts     # Shared components
```

### Helpers

```
src/helpers/api/{service}/     # API request helpers
src/helpers/{utility-name}.ts  # General utilities
```

---

## Test Data Management

<!-- YOUR PROJECT: Document your test data files here -->
<!-- Example:
| Type | Location | Examples |
|------|----------|---------|
| Test cards | `src/test-data/test-cards.ts` | Visa, Amex test card numbers |
| Guest users | `src/test-data/guest-users.ts` | Non-authenticated user data |
| Invalid inputs | `src/test-data/invalid-inputs.ts` | Boundary/edge case values |
| Expected strings | `src/test-data/strings/` | Expected UI text |
-->

---

## CI/CD Conventions

<!-- YOUR PROJECT: Document your CI conventions here -->
<!-- Example:
- **Workers:** 2 on CI, default locally
- **Retries:** 2 on CI, 0 locally
- **Trace:** `on-first-retry` on CI (traces contain cookies and request bodies; restrict artifact access), `on` locally when debugging
- **Screenshots/video:** `only-on-failure` / `retain-on-failure`
- **Reporter:** `blob` + `github` on CI (merged into HTML), `html` + `list` locally
- **Sharding:** 4 shards on CI (see `ci-and-flake-triage.md`)
- **Smoke tests** run in: this repo's pipeline + main app pipeline
-->

---

## ESLint — Playwright Plugin Rules

`eslint-plugin-playwright` is recommended with `plugin:playwright/recommended` enabled. Key rules:

| Rule | Recommended Status | Rationale |
|------|--------|-----------|
| `playwright/no-wait-for-timeout` | enabled | Catches hardcoded waits |
| `playwright/no-force-option` | enabled | Catches force:true |
| `playwright/no-page-pause` | enabled | Catches leftover debug pauses |
| `playwright/no-conditional-in-test` | evaluate | May need to disable if tests use legitimate conditionals |
| `playwright/expect-expect` | evaluate | May give false positives with `test.step()` patterns |
