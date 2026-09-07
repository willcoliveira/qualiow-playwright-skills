# Locators and Assertions

## Strict mode

Every action and most assertions require the locator to match **exactly one** element. A locator that matches two elements fails with `strict mode violation` instead of silently using the first one. Treat that error as a locator bug, not a timing bug.

```typescript
// Fails if the page has two "Delete" buttons
await page.getByRole('button', { name: 'Delete' }).click()

// Narrow the locator instead of reaching for .first()
await page.getByRole('row', { name: 'Invoice 1042' }).getByRole('button', { name: 'Delete' }).click()

// Assert a count when several matches are expected
await expect(page.getByRole('listitem')).toHaveCount(3)
```

`first()`, `last()` and `nth()` are last resorts: they encode layout order, which changes.

---

## Selector priority

1. `getByRole(role, { name })` — what users and assistive tech see; survives markup changes
2. `getByLabel(text)` — form fields
3. `getByText(text)` / `getByPlaceholder` / `getByAltText` / `getByTitle` — visible text
4. `getByTestId(id)` — stable hook when there is no accessible name
5. `locator('css')` — structural fallback, never layout-dependent (`div > div:nth-child(3)`)

Never XPath.

Useful `getByRole` options: `exact: true` (whole-name match), `level` for headings, `checked`/`pressed`/`expanded` for state, `includeHidden` only when you really mean hidden elements.

```typescript
page.getByRole('heading', { name: 'Orders', level: 2 })
page.getByRole('checkbox', { name: 'Accept terms', checked: false })
page.getByText('Total', { exact: true })
```

---

## Composing locators

```typescript
const row = page.getByRole('row').filter({ hasText: 'Invoice 1042' })
const rowWithFailedBadge = page.getByRole('row').filter({ has: page.getByText('Failed') })
const rowsWithoutActions = page.getByRole('row').filter({ hasNot: page.getByRole('button') })
const visibleAlerts = page.getByRole('alert').filter({ visible: true })

// Both conditions on the same element
const primarySubmit = page.getByRole('button', { name: 'Submit' }).and(page.locator('.primary'))

// Either of two elements
const dismiss = page.getByRole('button', { name: 'Close' }).or(page.getByRole('button', { name: 'Dismiss' }))

// Chain to scope
const cardNumber = page.getByRole('region', { name: 'Payment' }).getByLabel('Card number')
```

Chaining scopes the search; `filter()` narrows the matched set. Both keep the locator lazy, so it re-resolves on every action and assertion.

---

## Iframes

```typescript
// Locate the iframe, then enter it
const payment = page.locator('iframe[title="Secure payment"]').contentFrame()
await payment.getByLabel('Card number').fill('4242 4242 4242 4242')
await expect(payment.getByText('Card accepted')).toBeVisible()
```

`page.frameLocator(selector)` is the older equivalent; `contentFrame()` composes with any locator, and `frameLocator.owner()` goes back to the `<iframe>` element.

---

## Web-first assertions

`expect(locator)` assertions retry until they pass or the expect timeout (default 5s) elapses. `expect(value)` assertions check once. Prefer the retrying kind for anything on the page.

```typescript
// Retries until visible
await expect(page.getByRole('alert')).toBeVisible()

// Checks once, at the moment it runs: flaky
expect(await page.getByRole('alert').isVisible()).toBe(true)
```

| Need | Assertion |
|------|-----------|
| Text, whole element | `toHaveText('Order placed')` (normalises whitespace; accepts regex) |
| Text, substring | `toContainText('placed')` |
| Input value | `toHaveValue('42')` |
| Attribute / class | `toHaveAttribute('aria-invalid', 'true')`, `toHaveClass(/active/)` |
| Count | `toHaveCount(3)` |
| State | `toBeVisible()`, `toBeHidden()`, `toBeEnabled()`, `toBeDisabled()`, `toBeChecked()`, `toBeFocused()`, `toBeEditable()`, `toBeInViewport()` |
| Accessibility | `toHaveAccessibleName('Close')`, `toHaveAccessibleDescription(...)`, `toHaveRole('dialog')` |
| Page | `expect(page).toHaveURL(/\/orders\/\d+/)`, `toHaveTitle(/Orders/)` |

Prefer the positive form of the opposite state (`toBeHidden()`) over `.not.toBeVisible()`: the message on failure is clearer and the intent is explicit.

Add a message when the assertion is not self-explanatory:

```typescript
await expect(page.getByTestId('order-total'), 'total must include the 10% promo').toHaveText('$90.00')
```

### Soft assertions

Soft assertions record the failure and let the test continue, so one run reports every broken field instead of the first one.

```typescript
await expect.soft(page.getByTestId('status')).toHaveText('Shipped')
await expect.soft(page.getByTestId('eta')).toHaveText('Tomorrow')
// Bail out before doing something destructive if anything failed so far
expect(test.info().errors).toHaveLength(0)
```

Use them for verification blocks, never for preconditions.

### Custom timeouts

```typescript
await expect(page.getByText('Report ready')).toBeVisible({ timeout: 30_000 })

// Per-file default
const slowExpect = expect.configure({ timeout: 15_000 })
```

Set the suite default in `playwright.config.ts` (`expect: { timeout: 10_000 }`) rather than sprinkling timeouts through tests.

---

## Aria snapshots

`toMatchAriaSnapshot` asserts the accessibility tree of a region in one assertion. It is the right tool for "this whole component renders correctly" checks and for structure that is hard to express with individual assertions.

```typescript
await expect(page.getByRole('navigation')).toMatchAriaSnapshot(`
  - navigation:
    - link "Home"
    - link "Orders"
    - button "Account menu"
`)
```

- Generate the template from the real page: `playwright-cli snapshot` prints the same YAML, or run the assertion empty and `npx playwright test --update-snapshots` fills it in.
- Use regex for dynamic text: `- heading /Order #\\d+/`.
- Keep snapshots small and scoped to one region; a whole-page snapshot fails on every unrelated change.

---

## Visual comparison

```typescript
await expect(page.getByTestId('price-chart')).toHaveScreenshot('price-chart.png', {
  maxDiffPixelRatio: 0.01,
  mask: [page.getByTestId('timestamp')],
})
```

- Baselines are platform-specific (`price-chart-chromium-linux.png`); generate them on the same OS as CI, ideally inside the Playwright Docker image.
- Update deliberately with `npx playwright test --update-snapshots`, and review the diff in the HTML report.
- Mask or hide anything dynamic (timestamps, avatars, animations: `animations: 'disabled'` is the default).

---

## Network mocking inside tests

Register routes **before** the navigation or action that triggers the request.

```typescript
// Stub a response
await page.route('**/api/products', route => route.fulfill({ json: [{ id: 1, name: 'Widget' }] }))

// Modify the real response
await page.route('**/api/products', async route => {
  const response = await route.fetch()
  const json = await response.json()
  json.push({ id: 999, name: 'Injected' })
  await route.fulfill({ response, json })
})

// Simulate failure
await page.route('**/api/products', route => route.fulfill({ status: 500, body: 'boom' }))
await page.route('**/api/analytics/**', route => route.abort())

await page.goto('/products')
```

Record and replay a whole API surface with HAR:

```typescript
// update: true records, false replays; commit the .har file
await page.routeFromHAR('tests/har/products.har', { url: '**/api/**', update: false })
```

Mocks make tests deterministic and fast, but they also stop the test from catching backend regressions. Mock third parties and rare error paths; keep the happy path against the real API.

---

## Controlling time

```typescript
// Install before navigation so the page never sees real time
await page.clock.install({ time: new Date('2025-01-15T09:00:00') })
await page.goto('/dashboard')

// Jump ahead to trigger timers (auto-logout, polling, countdowns)
await page.clock.fastForward('30:00')

// Freeze time so timestamps in the UI are stable
await page.clock.setFixedTime(new Date('2025-01-15T09:00:00'))

// Pause at a moment and resume
await page.clock.pauseAt(new Date('2025-01-15T09:05:00'))
await page.clock.resume()
```

Use `fastForward` for "the user waited N minutes" scenarios, `runFor` for precise timer ticks, and `setFixedTime` for screenshot stability.
