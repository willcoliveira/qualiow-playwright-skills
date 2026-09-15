# Page Object Conventions — {{PROJECT_NAME}}

## Selector Priority

1. **`page.getByRole()`** — most resilient; recommended for all interactive elements
2. **`page.getByLabel()`** — form fields with labels
3. **`page.getByText()`** / **`page.getByPlaceholder()`** / **`page.getByAltText()`** — visible text content
4. **`page.getByTestId()`** — `data-testid` attributes (cross-reference the source repo)
5. **`page.locator('css-selector')`** — CSS as a last resort, never layout-dependent

**Never use XPath.** Elements inside iframes use the same ladder after `.contentFrame()` (see below).

---

## Page Object Class Structure

```typescript
import type { Page, Locator } from '@playwright/test'
{{#if HAS_CUSTOM_FIXTURE}}
import { test, expect } from '{{FIXTURE_IMPORT_PATH}}'
{{else}}
import { test, expect } from '@playwright/test'
{{/if}}

export class ExamplePage {
  // Always store page reference
  readonly page: Page

  // Locators as readonly class properties
  readonly pageHeading: Locator
  readonly submitButton: Locator

  // Every outcome the form can produce, so a test can assert which one happened
  readonly successMessage: Locator
  readonly errorMessage: Locator
  readonly emailFieldError: Locator

  constructor(page: Page) {
    this.page = page
    // Define locators in constructor; they are lazy and re-resolve on every use
    this.pageHeading = page.getByRole('heading', { name: 'Example' })
    this.submitButton = page.getByRole('button', { name: 'Submit' })
    this.successMessage = page.getByRole('status')
    this.errorMessage = page.getByRole('alert')
    this.emailFieldError = page.getByTestId('email-error')
  }

  // Methods wrapped in test.step() for trace reporting
  async submit() {
    await test.step('Submit the form', async () => {
      await this.submitButton.click()
    })
  }

  // Assertion methods prefixed with 'expect'
  async expectPageHeading(options?: { timeout?: number }) {
    await test.step('Verify page heading is visible', async () => {
      await expect(this.pageHeading).toBeVisible(options)
    })
  }
}
```

---

## A page object for a form exposes its feedback

A page object that can submit but cannot report what happened is incomplete. Every form or CRUD
page needs locators for all three outcomes:

- **success** — the confirmation, banner or redirect target that means it worked
- **error** — the form-level failure message
- **field validation** — the per-field message, for the fields that have one

Without them, the only thing a test can assert is that the click did not throw. That test passes
when the form silently rejects the submission, which is the exact regression it was written to
catch — and it keeps passing, so nobody looks at it again.

The rule is checkable at review time: if the page object has an action method and no locator whose
name says success, error or validation, it is not finished.

---

## Component Composition

Shared UI elements are modeled as components and composed into page objects:

```typescript
// Component ({{PAGE_OBJECTS_DIR}}/components/basket.ts)
export class Basket {
  readonly page: Page
  readonly orderTotal: Locator

  constructor(page: Page) {
    this.page = page
    this.orderTotal = page.getByTestId('order-total')
  }
}

// Page using component
export class CheckoutPage {
  readonly basketComponent: Basket
  readonly formComponent: CheckoutForm

  constructor(page: Page) {
    this.basketComponent = new Basket(page)
    this.formComponent = new CheckoutForm(page)
  }
}
```

Scope a component to its container when the same widget appears more than once on a page:

```typescript
constructor(readonly root: Locator) {
  this.orderTotal = root.getByTestId('order-total')
}
// new Basket(page.getByRole('region', { name: 'Your basket' }))
```

<!-- YOUR PROJECT: Add your component inventory here -->
<!-- Example:
| Component | File | Used In |
|-----------|------|---------|
| `Basket` | `src/pages/components/basket.ts` | Checkout, billing pages |
| `Header` | `src/pages/components/header.ts` | All pages |
-->

---

## Instantiating Page Objects

Prefer fixtures (see `fixtures-and-auth.md`); a lazy factory is the lightweight alternative:

```typescript
function createTestPages(page: Page) {
  return {
    get homePage() { return new HomePage(page) },
    get loginPage() { return new LoginPage(page) },
    get checkoutPage() { return new CheckoutPage(page) },
  }
}

const pages = createTestPages(page)
await pages.checkoutPage.submit()
```

<!-- YOUR PROJECT: List your available page objects here -->

---

## Iframe Handling

For payment widgets or embedded forms, locate the `<iframe>` and enter it with `.contentFrame()`:

```typescript
readonly paymentFrame: FrameLocator
readonly cardNumberField: Locator

constructor(page: Page) {
  this.paymentFrame = page.locator('iframe[title="Payment form"]').contentFrame()
  this.cardNumberField = this.paymentFrame.getByLabel('Card number')
}
```

Import `FrameLocator` from `@playwright/test`. Inside the frame, the normal selector ladder applies.

<!-- YOUR PROJECT: Document your iframe structure if applicable -->

---

## Method Conventions

| Pattern | Example | Usage |
|---------|---------|-------|
| `goto(path)` | `homePage.goto('/products')` | Navigate to a page (relative to `baseURL`) |
| `expectXxx()` | `checkoutPage.expectOrderConfirmed()` | Assertions |
| `selectXxx()` | `productPage.selectSize('Large')` | User selections |
| `enterXxx()` | `loginPage.enterEmail('user@test.com')` | Form input |
| `clickXxx()` | `cartPage.clickCheckout()` | Button clicks |
| `waitForXxx()` | `resultsPage.waitForResults()` | Wait for state (web-first assertion inside) |

Action methods return `Promise<void>`; the test decides which page object to use next.

---

## Naming Conventions

- **Page files:** `{name}.page.ts` (in `{{PAGE_OBJECTS_DIR}}/`)
- **Component files:** `{name}.ts` (in `{{PAGE_OBJECTS_DIR}}/components/`)
- **Test files:** `{feature-name}.spec.ts` (in `{{TEST_DIR}}/`)
- **Helper files:** `{name}.ts` (in `src/helpers/`)

<!-- YOUR PROJECT: Adjust naming conventions to match your project structure -->
