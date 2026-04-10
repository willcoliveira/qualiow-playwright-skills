# Test Debugging Skill — {{PROJECT_NAME}}

## Common Failure Patterns

<!-- YOUR PROJECT: Add your project-specific failure patterns here -->
<!-- Example row: | `Timeout waiting for selector` on payment fields | Payment iframe hasn't loaded | Increase timeout, use `frameLocator` for iframe | -->

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| `Timeout waiting for selector` | Element not yet rendered or selector changed | Check selector against current DOM; increase timeout |
| Test passes locally but fails on CI | Headless differences, timing, or missing env vars | CI uses fewer workers and retries; check env var presence in CI secrets |
| Element not clickable / intercepted | Another element overlapping or not yet hidden | Wait for overlay/loader to disappear; check z-index issues |
| `page.goto()` timeout | Page too slow to load or URL incorrect | Check base URL; wait for specific element instead of full load |
| Cookie/session issues | Cookie domain mismatch or expired session | Verify cookie injection; check auth setup in fixtures |
| Flaky assertion on dynamic content | Content updates asynchronously | Use `toPass()` or `expect.poll()` instead of single assertion |
{{#if HAS_PLAYWRIGHT_159}}
| API returning 4xx/5xx unexpectedly | Backend change or environment issue | Use `trace requests --failed` to inspect the full HTTP conversation |
{{/if}}

---

## Debugging Workflow

### 1. Read the Error Message

Playwright error messages include:
- **Selector** that failed to match
- **Timeout** that was exceeded
- **Expected vs actual** state

{{#if HAS_PLAYWRIGHT_159}}
### 2. CLI Debug Mode (Recommended for Agents)

Step through the failing test directly from the terminal — no browser UI needed:

```bash
# Run the failing test in CLI debug mode
npx playwright test {{TEST_DIR}}/checkout.spec.ts --debug=cli

# Filter to a specific test name
npx playwright test --debug=cli -g "should submit order"
```

Each step prints to the terminal as it executes. On failure, the trace is automatically captured for further analysis.

### 3. Analyze the Trace (CLI — Primary Approach)

When a test fails in CI, traces are captured automatically (with `trace: 'on-first-retry'` config). Analyze them entirely from the terminal:

```bash
# Open the trace file
npx playwright trace open test-results/failing-test/trace.zip

# Jump to the failing assertion
npx playwright trace actions --grep="expect"

# Inspect page state at the failure point (e.g. step 12)
npx playwright trace snapshot 12 --name after

# For API-related failures — inspect failed requests
npx playwright trace requests --failed

# Get full error details
npx playwright trace errors
```

### 4. Live Browser Inspection with browser.bind()

For debugging flaky or timing-sensitive tests, attach to a live browser session:

```typescript
// In a fixture or test setup
const browser = await chromium.launch()
const sessionUrl = await browser.bind()
// Agent connects to sessionUrl to inspect live DOM state
```

### 5. Inspect Page State with Playwright CLI
{{/if}}
{{#if NO_PLAYWRIGHT_159}}
### 2. Inspect Page State with Playwright CLI
{{/if}}

```bash
# Take a snapshot to see current DOM state
playwright-cli snapshot

# Check for specific elements
playwright-cli snapshot --selector "[data-testid='form']"

# Look for iframes
playwright-cli snapshot --selector "iframe"
```

{{#if HAS_PLAYWRIGHT_159}}
### 6. Use Trace Viewer (GUI — Fallback for Humans)
{{/if}}
{{#if NO_PLAYWRIGHT_159}}
### 3. Use Trace Viewer
{{/if}}

```bash
# Open trace file from test-reports
npx playwright show-trace test-reports/*/trace.zip

# Or use online viewer
# Upload trace.zip to trace.playwright.dev
```

Trace viewer shows:
- Screenshot at each step
- Network requests/responses
- Console output
- DOM snapshots
- Action log with timing

{{#if HAS_PLAYWRIGHT_159}}
### 7. Check CI Reports
{{/if}}
{{#if NO_PLAYWRIGHT_159}}
### 4. Check CI Reports
{{/if}}

CI generates HTML reports as artifacts:
- Download from the CI artifacts section
- Open `index.html` in a browser
- Reports include screenshots on failure

---

{{#if HAS_PLAYWRIGHT_159}}
## Agent Self-Healing Workflow

When an AI agent picks up a CI failure, follow this loop:

```
1. CI test fails → trace artifact produced
          ↓
2. npx playwright trace open <trace.zip>
          ↓
3. npx playwright trace actions --grep="expect"
   → Identify which assertion failed and at which step
          ↓
4. npx playwright trace snapshot <step> --name after
   → See exact page state at failure point
          ↓
5. npx playwright trace requests --failed
   → Check if API calls are failing (4xx/5xx)
          ↓
6. Classify root cause (see table below)
          ↓
7a. Test bug → Fix test code → Re-run with --debug=cli
7b. App bug → Do NOT fix test → Report bug
          ↓
8. npx playwright test <file> --debug=cli
   → Verify the fix passes
```

This workflow lets the agent investigate, fix, and verify — all from the terminal, without manual intervention.

---
{{/if}}

## Root Cause Classification

When a test fails, classify the root cause before attempting a fix:

{{#if HAS_PLAYWRIGHT_159}}
| Category | Description | Fix Strategy | How to Identify via Trace |
|----------|-------------|-------------|--------------------------|
| LOCATOR_CHANGED | Element selector no longer matches DOM | Update selector from page inspection or source repo | `trace snapshot` shows element exists with different attributes |
| NEW_PREREQUISITE | App now requires an interaction the test skips | Add the missing step using existing POM methods | `trace actions` shows unexpected modal/dialog before failure |
| ELEMENT_REMOVED | UI element was removed or replaced | Remove test step or use replacement element | `trace snapshot` shows element absent from DOM |
| TIMING_ISSUE | Race condition or insufficient wait | Add web-first assertion (`toBeVisible()`) or `waitForURL()` | `trace snapshot` before vs after shows element appearing late |
| DATA_CHANGED | Expected values no longer match (text, counts, prices) | Update assertion expected values | `trace snapshot` shows different text/content than expected |
| NAVIGATION_CHANGED | Routes or page flow restructured | Update `goto()` URLs and `waitForURL()` patterns | `trace actions` shows unexpected redirects or URL changes |
| API_FAILURE | Backend returning errors (4xx/5xx) | Check with backend team; may be app bug | `trace requests --failed` shows failing endpoints |
| APPLICATION_BUG | The app itself is broken — test correctly caught a real defect | Do NOT fix the test — report the bug | `trace errors` shows app-level exceptions |
{{/if}}
{{#if NO_PLAYWRIGHT_159}}
| Category | Description | Fix Strategy |
|----------|-------------|-------------|
| LOCATOR_CHANGED | Element selector no longer matches DOM | Update selector from page inspection or source repo |
| NEW_PREREQUISITE | App now requires an interaction the test skips | Add the missing step using existing POM methods |
| ELEMENT_REMOVED | UI element was removed or replaced | Remove test step or use replacement element |
| TIMING_ISSUE | Race condition or insufficient wait | Add web-first assertion (`toBeVisible()`) or `waitForURL()` |
| DATA_CHANGED | Expected values no longer match (text, counts, prices) | Update assertion expected values |
| NAVIGATION_CHANGED | Routes or page flow restructured | Update `goto()` URLs and `waitForURL()` patterns |
| APPLICATION_BUG | The app itself is broken — test correctly caught a real defect | Do NOT fix the test — report the bug |
{{/if}}

---

## App Bug vs Test Bug — Decision Tree

Before modifying a failing test, determine whether it's a test issue or an application bug:

1. **Would a real user hit this same failure?** If a human followed the exact same steps manually and encountered the same broken behavior → **APPLICATION BUG**
2. **Check the evidence:**
{{#if HAS_PLAYWRIGHT_159}}
   - `trace requests --failed` shows API returning 4xx/5xx that previously returned 2xx → likely app bug
   - `trace errors` shows unhandled exceptions in app code → likely app bug
   - UI shows error state despite correct inputs → likely app bug
   - `trace snapshot` shows element exists with different attributes → test bug (LOCATOR_CHANGED)
   - `trace actions` shows test skips a required interaction (new modal, new field) → test bug (NEW_PREREQUISITE)
{{/if}}
{{#if NO_PLAYWRIGHT_159}}
   - API returning 4xx/5xx that previously returned 2xx → likely app bug
   - Console shows unhandled exceptions in app code → likely app bug
   - UI shows error state despite correct inputs → likely app bug
   - Selector doesn't match but element exists with different attributes → test bug (LOCATOR_CHANGED)
   - Test skips a required interaction (new modal, new field) → test bug (NEW_PREREQUISITE)
{{/if}}

### When it IS an app bug:
- Do NOT modify the test
- Do NOT add `test.skip()` or `test.fixme()`
- Leave the test failing so CI keeps flagging the issue
- Report using the bug report template below

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
{{#if HAS_PLAYWRIGHT_159}}
> - Trace analysis: `npx playwright trace actions --grep="expect"` output
{{/if}}

---

## Environment Variable Issues

If tests fail immediately with credential errors, verify all required env vars are set:

<!-- YOUR PROJECT: List your required environment variables here -->
<!-- Example:
```
Required env vars:
AUTH_TOKEN     — Authentication token for staging
API_KEY        — API key for backend services
BASE_URL       — Application base URL
```
-->

Check `.env` file locally or CI secrets for your CI platform.
