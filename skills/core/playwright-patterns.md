# Playwright Patterns — Best Practices

## waitForResponse Ordering

The listener must be set up **before** the action that triggers the response. Never `await` the listener setup — store the promise, trigger the action, then await.

### Bad

```typescript
// DON'T: await the listener setup — this blocks forever
await page.waitForResponse('**/api/order')
await page.getByRole('button', { name: 'Submit' }).click()
```

### Good

```typescript
// DO: setup listener (no await) → trigger action → await response
const responsePromise = page.waitForResponse('**/api/order')
await page.getByRole('button', { name: 'Submit' }).click()
const response = await responsePromise
expect(response.status()).toBe(200)
```

### With URL pattern matching

```typescript
const responsePromise = page.waitForResponse(
  (resp) => resp.url().includes('/api/seats') && resp.status() === 200
)
await seatMapPage.selectSeat()
const response = await responsePromise
```

---

## toPass Pattern

Use `toPass()` to retry an assertion block until it passes. Key: use a **short inner timeout** so each attempt fails fast, while the **outer toPass timeout** controls total retry duration.

### When to use

- Waiting for a value that updates asynchronously (e.g. basket total after adding items)
- Polling for a UI state that requires multiple checks in sequence
- Any scenario where a single web-first assertion isn't sufficient

### Pattern

```typescript
await expect(async () => {
  const text = await page.getByTestId('order-total').textContent()
  expect(text).toContain('$25.00')
}).toPass({
  timeout: 30_000,     // total time to keep retrying
  intervals: [500, 1_000, 2_000]  // backoff between attempts
})
```

### With short inner timeout (recommended)

```typescript
await expect(async () => {
  // Inner timeout is SHORT — fail fast on each attempt
  await expect(page.getByTestId('confirmation'))
    .toBeVisible({ timeout: 1_000 })
  await expect(page.getByTestId('order-id'))
    .not.toBeEmpty({ timeout: 1_000 })
}).toPass({
  timeout: 30_000,
  intervals: [1_000, 2_000, 5_000]
})
```

---

## expect.poll Pattern

Use `expect.poll()` for non-DOM polling — API status checks, computed values, or any async function that returns a value.

### When to use

- Polling an API endpoint until it returns a specific status
- Waiting for a computed/derived value (not directly on a locator)
- Any non-DOM async check that needs retrying

### Pattern

```typescript
await expect.poll(async () => {
  const response = await page.request.get('/api/order/status')
  return response.json()
}, {
  timeout: 30_000,
  intervals: [1_000, 2_000, 5_000],
  message: 'Order status should become CONFIRMED'
}).toHaveProperty('status', 'CONFIRMED')
```

### vs toPass

| Feature | `toPass()` | `expect.poll()` |
|---------|-----------|-----------------|
| Use case | Multiple assertions in a block | Single value check |
| Input | Async function (runs assertions inside) | Async function (returns a value) |
| Assertion | Inside the block | Chained after `.poll()` |
| Best for | DOM state checks needing multiple locators | API polling, computed values |

---

## Network-First Safeguards

Register network listeners and route handlers **before** the navigation or action that triggers them. This prevents race conditions where the request fires before the listener is ready.

### Route interception

```typescript
// DO: register route BEFORE navigation
await page.route('**/api/analytics', (route) => route.abort())
await page.goto('/checkout')
```

### waitForResponse with navigation

```typescript
// DO: setup listener BEFORE goto
const configPromise = page.waitForResponse('**/api/config')
await page.goto('/checkout')
const config = await configPromise
```

### Multiple network events

```typescript
// Setup all listeners first, then trigger
const seatsPromise = page.waitForResponse('**/api/seats')
const pricingPromise = page.waitForResponse('**/api/pricing')

await page.getByRole('button', { name: 'Select seats' }).click()

const [seatsResponse, pricingResponse] = await Promise.all([
  seatsPromise,
  pricingPromise
])
```

### Anti-patterns to avoid

- **No `networkidle`** — it's flaky and deprecated in spirit. Wait for a specific element or response instead.
- **No arbitrary delays** — `waitForTimeout(2000)` before checking a response is a timing assumption, not a guarantee.
- **No `waitForLoadState('networkidle')`** — use `waitForURL()` or a web-first assertion on the target page's content.

---

## API Response Validation with Zod

Use Zod schemas to validate API helper responses at runtime. This catches contract changes early and provides clear error messages.

> **Note:** Requires the `zod` dependency. This is an optional enhancement.

### Pattern

```typescript
import { z } from 'zod'

const OrderResponseSchema = z.object({
  orderId: z.string(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']),
  total: z.number().positive(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number().int().positive()
  }))
})

type OrderResponse = z.infer<typeof OrderResponseSchema>

async function getOrder(orderId: string): Promise<OrderResponse> {
  const response = await request.get(`/api/orders/${orderId}`)
  const data = await response.json()
  return OrderResponseSchema.parse(data) // throws ZodError if shape is wrong
}
```

### Benefits

- **Self-documenting** — the schema IS the contract
- **Runtime safety** — catches unexpected `null`, missing fields, wrong types
- **Clear errors** — Zod errors pinpoint exactly which field failed validation
- **Type inference** — `z.infer<typeof Schema>` generates TypeScript types from the schema
