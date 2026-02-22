# Project Conventions — {{PROJECT_NAME}}

## Constitution-Style Rules

### MUST

1. **MUST** import `test` from your custom fixture file, NOT from `@playwright/test` (if using custom fixtures)
2. **MUST** use web-first assertions (`await expect(locator).toBeVisible()`) — never one-shot checks (`expect(await locator.isVisible()).toBe(true)`)
3. **MUST** use named timeout constants instead of hardcoded numbers
4. **MUST** wrap page object methods in `test.step()` for trace reporting
5. **MUST** use POM pattern — locators as readonly class properties, methods for interactions
6. **MUST** use short inner timeouts inside `toPass` blocks (e.g. `{ timeout: 1_000 }` for inner assertions when outer `toPass` has `{ timeout: 30_000 }`)
7. **MUST** clean up test resources in `afterEach` hooks (cancel orders, release reservations, etc.)
8. **MUST** tag tests appropriately for CI filtering

<!-- YOUR PROJECT: Add project-specific MUST rules here -->
<!-- Example:
9. **MUST** use `createTestUser` fixture for creating new test users
10. **MUST** clean up resources in `afterEach` via API helper
-->

### SHOULD

1. **SHOULD** use `test.step()` in test specs for complex multi-step assertions
2. **SHOULD** prefer `getByRole()` over `getByTestId()` over CSS selectors
3. **SHOULD** cross-reference the source application repo for selectors and component structure
4. **SHOULD** add comments explaining non-obvious timeouts or workarounds
5. **SHOULD** use descriptive test names that explain the user journey, not the implementation
6. **SHOULD** keep test data in dedicated data files, not inline in tests
7. **SHOULD** use `{ exact: true }` for `getByText()` / `getByRole()` when the text could match multiple elements
8. **SHOULD** prefer positive assertions (`toBeHidden()`, `toBeDisabled()`) over negated ones (`.not.toBeVisible()`, `.not.toBeEnabled()`)
9. **SHOULD** use semantic timeout names that match the operation:
   - `SHORT` (5s) — quick visibility checks
   - `MEDIUM` (10s) — standard interactions
   - `LONG` (15s) — slow-loading elements (iframes, heavy pages)
   - `ACTION` (30s) — action timeouts
   - `EXTENDED` (60s) — retryable operations (toPass, polling)

<!-- YOUR PROJECT: Add project-specific SHOULD rules here -->

### WON'T

1. **WON'T** use XPath selectors (fragile, hard to read)
2. **WON'T** use `page.waitForTimeout()` for synchronization (use `expect().toBeVisible()` or `waitFor()` instead)
3. **WON'T** use hardcoded credentials in test files (use env vars via `.env` or CI secrets)
4. **WON'T** take full-page screenshots in tests (use Playwright's `screenshot: 'only-on-failure'` config)
5. **WON'T** use `test.only()` or `test.skip()` in committed code (CI uses `forbidOnly: true`)
6. **WON'T** commit `.env` files or expose secrets in traces
7. **WON'T** duplicate test coverage already handled by unit/component tests in the source repo
8. **WON'T** use magic number timeouts — always use named constants
9. **WON'T** use `{ force: true }` on actions — if users can't click it, the test shouldn't force it
10. **WON'T** use `networkidle` in `goto()` or `waitForLoadState()` — wait for a user-visible element instead
11. **WON'T** add redundant waits before auto-wait actions (e.g. `waitFor({ state: 'visible' })` before `.click()`)
12. **WON'T** use deprecated APIs (`waitForNavigation`, `Promise.all` with navigation) — use `waitForURL()` or web-first assertions
13. **WON'T** use `page.evaluate()` / `page.addInitScript()` as workarounds for test issues — fix through real UI interactions
14. **WON'T** return new page objects from POM action methods — actions return `Promise<void>`, let the test decide what page to use next
15. **WON'T** write custom retry/polling loops — use `toPass()` or `expect.poll()` instead

<!-- YOUR PROJECT: Add project-specific WON'T rules here -->

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
- One `test.describe()` per file with tags in the describe title
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
- **Workers:** 2 on CI, 8 locally
- **Retries:** 2 on CI, 0 locally
- **Trace:** Off on CI (credential exposure risk), on locally
- **Reporter:** HTML only
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
