# Playwright E2E Testing Instructions

## Overview

This project uses Playwright for E2E testing. Follow these patterns and conventions when writing, debugging, or reviewing tests.

## Key Rules

### MUST
- Use web-first assertions (`await expect(locator).toBeVisible()`) — never one-shot checks
- Use named timeout constants instead of hardcoded numbers
- Wrap page object methods in `test.step()` for trace reporting
- Use POM pattern — locators as readonly class properties, methods for interactions
- Use short inner timeouts inside `toPass` blocks
- Clean up test resources in `afterEach` hooks

### WON'T
- Use XPath selectors (fragile, hard to read)
- Use `page.waitForTimeout()` for synchronization
- Use `{ force: true }` on actions
- Use `networkidle` in `goto()` or `waitForLoadState()`
- Use deprecated APIs (`waitForNavigation`, `Promise.all` with navigation)
- Write custom retry/polling loops (use `toPass()` or `expect.poll()`)
- Use `page.evaluate()` as workarounds for test issues

## Selector Priority
1. `getByRole()` — Most resilient
2. `getByLabel()` — For form fields
3. `getByText()` — For visible text
4. `getByTestId()` — For data-testid attributes
5. CSS selector — Last resort

## Critical Patterns

### waitForResponse — Setup BEFORE action
```typescript
const responsePromise = page.waitForResponse('**/api/data')
await page.getByRole('button', { name: 'Submit' }).click()
const response = await responsePromise
```

### toPass — Short inner timeout, long outer
```typescript
await expect(async () => {
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 1_000 })
}).toPass({ timeout: 30_000, intervals: [1_000, 2_000, 5_000] })
```

### expect.poll — For non-DOM polling
```typescript
await expect.poll(async () => {
  const response = await page.request.get('/api/status')
  return response.json()
}, { timeout: 30_000 }).toHaveProperty('status', 'CONFIRMED')
```

## Test Review Checklist
1. **Assertions** — web-first only, no one-shot checks
2. **Selectors** — getByRole priority, no XPath
3. **Timing** — no waitForTimeout, no networkidle
4. **Isolation** — independent tests, proper cleanup
5. **POM** — readonly locators, test.step() wrapping
6. **Readability** — descriptive names, no magic numbers
7. **Reliability** — toPass/poll over custom loops, no force:true

## Root Cause Classification
- **LOCATOR_CHANGED** — Update selector from page inspection
- **NEW_PREREQUISITE** — Add missing interaction step
- **TIMING_ISSUE** — Add web-first assertion or waitForURL()
- **APPLICATION_BUG** — Do NOT fix the test, report the bug
