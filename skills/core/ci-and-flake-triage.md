# CI and Flake Triage

## Configuration that pays for itself on CI

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,          // a committed test.only fails the build
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,                        // per test
  expect: { timeout: 10_000 },            // per web-first assertion
  reporter: process.env.CI
    ? [['blob'], ['github']]              // blob for sharding, github for inline annotations
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,                // default is 0 (no limit); set one so hangs fail fast
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
  ],
})
```

Artifacts to upload from CI: `test-results/` (traces, screenshots, videos of failures) and `playwright-report/` or `blob-report/`.

---

## Parallelism and ordering

- `fullyParallel: true` runs tests inside a file in parallel too. Tests must not share state.
- `test.describe.configure({ mode: 'serial' })` runs a block in order and skips the rest after a failure. Use it only for genuinely sequential journeys; it hides independent failures and cannot be sharded across workers.
- `test.describe.configure({ mode: 'parallel' })` opts one file into parallelism when the global setting is off.
- `test.describe.configure({ retries: 0 })` / `{ timeout: 120_000 }` override per block.

```typescript
test.describe.configure({ mode: 'serial' })
test.describe('checkout journey', () => {
  test('adds to basket', async ({ page }) => { /* ... */ })
  test('pays', async ({ page }) => { /* ... */ })
})
```

---

## Sharding

Split the suite across CI machines; each shard runs a slice and writes a blob report, then one job merges them.

```yaml
# .github/workflows/e2e.yml
name: E2E
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    container: mcr.microsoft.com/playwright:v1.62.0-noble   # match your @playwright/test version
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright test --shard=${{ matrix.shard }}/4
        env:
          BASE_URL: ${{ vars.E2E_BASE_URL }}
          E2E_USER_EMAIL: ${{ secrets.E2E_USER_EMAIL }}
          E2E_USER_PASSWORD: ${{ secrets.E2E_USER_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: blob-report-${{ matrix.shard }}
          path: blob-report
          retention-days: 1

  report:
    needs: test
    if: ${{ !cancelled() }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - uses: actions/download-artifact@v4
        with: { path: all-blob-reports, pattern: blob-report-*, merge-multiple: true }
      - run: npx playwright merge-reports --reporter html ./all-blob-reports
      - uses: actions/upload-artifact@v4
        with:
          name: html-report
          path: playwright-report
          retention-days: 14
```

Without the container image, run `npx playwright install --with-deps` after `npm ci`.

Useful selection flags: `--project chromium`, `--grep @smoke`, `--grep-invert @slow`, `--last-failed`, `--only-changed` (tests affected by uncommitted or branch changes), `--repeat-each 10`.

---

## Marking tests honestly

| Situation | Use | Not |
|-----------|-----|-----|
| Known bug, test should fail until fixed | `test.fail(true, 'BUG-123')` — passes when it fails, fails when it unexpectedly passes | Commenting out the assertion |
| Test is broken or feature not ready | `test.fixme(true, 'BUG-456')` — skipped, tracked | `test.skip()` with no reason |
| Not applicable on some browser/env | `test.skip(browserName === 'webkit', 'WebKit lacks X')` | A bare `test.skip()` |
| Legitimately slow | `test.slow()` — triples the timeout | A hardcoded `test.setTimeout(999_999)` |

```typescript
test('exports a PDF', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'PDF export is Chromium-only')
  test.slow()
  // ...
})
```

`test.skip(condition, reason)` inside a test is fine in committed code; a bare `test.skip()` or `test.only()` is not.

---

## Flake triage

A test is flaky when it fails and then passes on retry with no code change. Retries hide flakes from the build status, so surface them: the HTML report marks them "flaky", `--fail-on-flaky-tests` turns them into failures, and CI reporters expose the count.

### Triage steps

1. **Collect evidence.** Open the trace of the failed attempt (`test-results/<name>-retry1/trace.zip`). The first attempt has no trace with `on-first-retry`; the retry does.
2. **Reproduce locally under stress.**
   ```bash
   npx playwright test tests/checkout.spec.ts -g "pays" --repeat-each 20 --workers 1
   npx playwright test tests/checkout.spec.ts -g "pays" --repeat-each 20 --workers 8
   ```
   Failing only with many workers points at shared state; failing at `--workers 1` points at timing in the test itself.
3. **Classify** using the table below, then fix the cause. Do not add retries, `waitForTimeout()`, or a larger timeout as the fix.
4. **Quarantine if you cannot fix it now** with `test.fixme(true, 'FLAKE-789')` so it stays visible, and open a ticket.

### Common causes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Fails only with many workers | Shared account, record or fixture mutated in parallel | Per-worker accounts, dynamic data factories, cleanup in `afterEach` |
| `strict mode violation` sometimes | Optimistic UI renders a second element briefly | Narrow the locator (`filter`, scoped chain); assert the transient state first |
| Assertion fails then passes | Assertion on a value that updates asynchronously | `expect(locator)` web-first assertion, `toPass()` or `expect.poll()` |
| Click has no effect | Element re-rendered between locate and click, or overlay in the way | Wait for the overlay to be hidden; assert the enabled state; never `force: true` |
| Passes locally, fails on CI | Slower machine, different viewport, missing env var | Assert on state rather than timing; set viewport explicitly; check secrets |
| Fails after a navigation | Listener registered after the request fired | `waitForResponse` promise before the action; `page.route` before `goto` |
| Randomly times out at 30s | Missing `actionTimeout`, hung network call | Set `actionTimeout`, inspect `requests` in the trace |
| Snapshot/visual diff | Animation, timestamp, font loading | `mask`, `page.clock.setFixedTime`, wait for fonts |

### Retries are a safety net, not a strategy

- Keep `retries` at 1–2 on CI and 0 locally so flakes are visible while developing. Use `retries: 0`
  for anything asserting on money or correctness, where a retry turns a real race into a green tick;
  `pass-rate-and-flake-analysis.md` covers how to prove determinism rather than retry around it.
- Track the flaky count per week; a rising number means the suite is losing trust.
- Any test that needed a retry in three consecutive runs gets a ticket.
