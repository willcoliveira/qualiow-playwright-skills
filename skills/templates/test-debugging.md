# Test Debugging Skill — {{PROJECT_NAME}}

## Common Failure Patterns

<!-- YOUR PROJECT: Add your project-specific failure patterns here -->
<!-- Example row: | `Timeout waiting for selector` on payment fields | Payment iframe hasn't loaded | Wait for the iframe, then use `.contentFrame()` | -->

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| `Timeout ... waiting for locator` | Element not rendered yet or selector changed | Check the selector against the current page; assert the state the element depends on |
| `strict mode violation` | Locator matches more than one element | Narrow with `getByRole({ name, exact })`, `filter()` or a scoped chain |
| Test passes locally but fails on CI | Timing, viewport, missing env vars, shared data across workers | See `ci-and-flake-triage.md`; check CI secrets and per-worker data |
| Element not clickable / intercepted | Overlay or loader still visible | Assert the overlay is hidden first; never `force: true` |
| `page.goto()` timeout | Slow page or wrong URL | Check `baseURL`; wait for a specific element instead of the load event |
| Cookie/session issues | Stale `storageState`, cookie domain mismatch | Re-run the auth setup project; see `fixtures-and-auth.md` |
| Flaky assertion on dynamic content | Content updates asynchronously | Web-first assertion, `toPass()` or `expect.poll()` |
| API returning 4xx/5xx unexpectedly | Backend change or environment issue | Inspect the failed request in the trace; likely an app or environment bug |

---

## Debugging Workflow

### 1. Read the error message

Playwright errors include the locator that failed, the timeout that was exceeded, the expected vs received state, and the call log with every retry. Read the call log before touching the test.

### 2. Reproduce one test

```bash
# Only the failing test, one browser, trace for every attempt
npx playwright test {{TEST_DIR}}/checkout.spec.ts -g "submits an order" --project chromium --trace on
```

{{#if HAS_PLAYWRIGHT_159}}
### 3. Attach to the paused test (agents)

`npx playwright test ... --debug=cli` pauses the test at its first action and prints a session name; `playwright-cli attach <session>` then lets you step through it and inspect the live page, with every command printing the matching Playwright code. The full loop is in `agent-debugging.md`.

### 4. Triage the trace from the terminal

`npx playwright trace open <trace.zip>`, then `errors`, `actions --errors-only`, `snapshot <id> --phase after`, `requests --failed`, `console --errors-only`. Reading order and what each answer means: `agent-debugging.md`.
{{else}}
### 3. Step through interactively

```bash
# Playwright Inspector pauses before each action
npx playwright test {{TEST_DIR}}/checkout.spec.ts -g "submits an order" --debug

# UI mode with time-travel
npx playwright test --ui
```

### 4. Inspect the trace

```bash
npx playwright show-trace test-results/checkout-submits-an-order-chromium/trace.zip
```

Look at the failing action's before/after snapshots, the network tab for 4xx/5xx, and the console tab for app errors. Upgrading to Playwright 1.59+ unlocks `--debug=cli` and `npx playwright trace` for terminal-only triage (`agent-debugging.md`).
{{/if}}

### 5. Check the page with `playwright-cli`

```bash
# Explore the real page to validate a selector before changing the test
playwright-cli open {{BASE_URL}}/checkout --headed
playwright-cli snapshot
playwright-cli find "Place order"
playwright-cli snapshot "#checkout-form"
playwright-cli generate-locator e12
playwright-cli close
```

### 6. CI artifacts

- `test-results/` holds traces, screenshots and videos of failed attempts (with `trace: 'on-first-retry'`, the retry has the trace).
- `playwright-report/` (or the merged blob report) shows every attempt, the retry count and "flaky" markers.

---

## Root Cause Classification

Classify before you change anything:

| Category | Description | Evidence in the trace | Fix Strategy |
|----------|-------------|-----------------------|--------------|
| LOCATOR_CHANGED | Selector no longer matches | Snapshot shows the element with different role/name/attributes | Update the locator (prefer `getByRole`) or the page object |
| NEW_PREREQUISITE | App now requires an interaction the test skips | Unexpected modal/dialog/step before the failing action | Add the missing step through existing page-object methods |
| ELEMENT_REMOVED | UI element removed or replaced | Element absent from the snapshot; replacement present | Remove the step or target the replacement |
| TIMING_ISSUE | Race or insufficient wait | Element appears in a later snapshot; assertion ran too early | Web-first assertion, `waitForURL()`, `waitForResponse` before the action |
| DATA_CHANGED | Expected values changed (text, counts, prices) | Snapshot text differs from the assertion | Update expected values or the data factory |
| NAVIGATION_CHANGED | Routes or flow restructured | Unexpected redirect or URL in the actions list | Update `goto()` paths and `waitForURL()` patterns |
| API_FAILURE | Backend returns 4xx/5xx | Failed request in the network log | Confirm with the backend; often an app or environment bug |
| APPLICATION_BUG | The app is broken; the test caught a real defect | Console errors, error state despite correct input | Do NOT fix the test; report the bug |

---

## App Bug vs Test Bug — Decision Tree

1. **Would a real user hit this same failure?** If a human following the same steps sees the same broken behaviour → **APPLICATION BUG**.
2. **Check the evidence:**
   - A request that used to return 2xx now returns 4xx/5xx → likely app bug
   - Unhandled exception in application code in the console → likely app bug
   - UI shows an error state despite correct inputs → likely app bug
   - Element exists with different attributes → test bug (LOCATOR_CHANGED)
   - Test skips a required interaction (new modal, new field) → test bug (NEW_PREREQUISITE)

### When it IS an app bug

- Do NOT modify the test
- Do NOT add `test.skip()`; if the suite must stay green, use `test.fail(true, 'BUG-123')` so the test flips back when the bug is fixed
- Report using the template below

### Bug Report Template

> **Title:** [BUG] {concise description}
> **Environment:** {browser, base URL, environment}
>
> **Steps to Reproduce (manual):**
> 1. Navigate to {URL}
> 2. {step as manual user action}
> 3. ...
>
> **Expected:** {what should happen}
> **Actual:** {what happens instead}
>
> **Technical Evidence:**
> - Failing endpoint: `{METHOD} {URL}` → {status}
> - Console errors: `{messages}`
> - Test file: `{file path}:{line number}`
> - Trace: `test-results/{test-name}/trace.zip` (attach it)

---

## Environment Variable Issues

If tests fail immediately with credential errors, verify all required env vars are set:

<!-- YOUR PROJECT: List your required environment variables here -->
<!-- Example:
```
Required env vars:
BASE_URL            — Application base URL
E2E_USER_EMAIL      — Login for the auth setup project
E2E_USER_PASSWORD   — Password for the auth setup project
API_KEY             — API key for backend helpers
```
-->

Check the local `.env` file or the CI secrets for your CI platform.
