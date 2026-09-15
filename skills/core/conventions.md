# Conventions

The rules every test in this project follows. They are not style preferences: each one exists
because its absence produced a failure that was expensive to diagnose.

MUST rules are non-negotiable — a review rejects the change. SHOULD rules are the default, and a
deviation needs a reason written down next to it. WON'T rules describe things that look like they
work and do not.

{{#if HAS_TEMPLATES}}Project-specific additions — your components, fixtures, env vars, tags and CI settings — live in
`project-conventions.md`.{{else}}Project-specific additions belong in a file of your own alongside this one; install the
`templates` pack to get a starting point for it.{{/if}}

## MUST

1. **MUST** import `test` and `expect` from {{#if HAS_CUSTOM_FIXTURE}}`{{FIXTURE_IMPORT_PATH}}`{{else}}the project fixtures file once one exists{{/if}}, NOT from `@playwright/test`
2. **MUST** use web-first assertions (`await expect(locator).toBeVisible()`) — never one-shot checks (`expect(await locator.isVisible()).toBe(true)`)
3. **MUST** use named timeout constants instead of hardcoded numbers
4. **MUST** wrap page object methods in `test.step()` for trace reporting
5. **MUST** use POM pattern — locators as readonly class properties, methods for interactions
6. **MUST** use short inner timeouts inside `toPass` blocks (e.g. `{ timeout: 1_000 }` for inner assertions when outer `toPass` has `{ timeout: 30_000 }`)
7. **MUST** clean up test resources in `afterEach` hooks (cancel orders, release reservations, etc.)
8. **MUST** tag tests for CI filtering using the options object (`test.describe('Checkout', { tag: ['@smoke'] }, ...)`), not the title

<!-- YOUR PROJECT: Add project-specific MUST rules here -->
<!-- Example:
9. **MUST** use `createTestUser` fixture for creating new test users
10. **MUST** clean up resources in `afterEach` via API helper
-->

## SHOULD

1. **SHOULD** use `test.step()` in test specs for complex multi-step assertions
2. **SHOULD** follow the selector ladder: `getByRole()` > `getByLabel()` > `getByText()` / `getByPlaceholder()` / `getByAltText()` > `getByTestId()` > CSS (the full ladder is in `locators-and-assertions.md`)
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
   - `ACTION` (30s) — `actionTimeout` in config (Playwright's default is 0 = no limit, so set one)
   - `EXTENDED` (60s) — retryable operations (`toPass`, `expect.poll`)

<!-- YOUR PROJECT: Add project-specific SHOULD rules here -->

## WON'T

1. **WON'T** use XPath selectors (fragile, hard to read)
2. **WON'T** use `page.waitForTimeout()` for synchronization (use `expect().toBeVisible()` or `waitFor()` instead)
3. **WON'T** use hardcoded credentials in test files (use env vars via `.env` or CI secrets)
4. **WON'T** take full-page screenshots in tests (use Playwright's `screenshot: 'only-on-failure'` config)
5. **WON'T** commit `test.only()` or a bare `test.skip()` (CI uses `forbidOnly: true`); conditional `test.skip(cond, reason)`, `test.fixme(true, 'TICKET')` and `test.fail(true, 'TICKET')` are fine
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
