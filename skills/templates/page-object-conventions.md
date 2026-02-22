# Page Object Conventions — {{PROJECT_NAME}}

## Selector Priority

1. **`page.getByRole()`** — Most resilient, recommended for all interactive elements
2. **`page.getByLabel()`** — For form fields with labels
3. **`page.getByText()`** — For visible text content
4. **`page.getByTestId()`** — For `data-testid` attributes (cross-reference source repo)
5. **`page.locator('css-selector')`** — For CSS-based selection
6. **`page.frameLocator('iframe...')`** — For iframe fields (last resort)

**Never use XPath.**

---

## Page Object Class Structure

```typescript
import type { Page, Locator } from '@playwright/test'
{{#if HAS_CUSTOM_FIXTURE}}
import { test, expect } from '{{FIXTURE_IMPORT_PATH}}'
{{/if}}
{{#if NO_CUSTOM_FIXTURE}}
import { test, expect } from '@playwright/test'
{{/if}}

export class ExamplePage {
  // Always store page reference
  readonly page: Page

  // Locators as readonly class properties
  readonly pageHeading: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator

  constructor(page: Page) {
    this.page = page
    // Define locators in constructor
    this.pageHeading = page.getByRole('heading', { name: 'Example' })
    this.submitButton = page.getByRole('button', { name: 'Submit' })
    this.errorMessage = page.getByTestId('error-message')
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

<!-- YOUR PROJECT: Add your component inventory here -->
<!-- Example:
| Component | File | Used In |
|-----------|------|---------|
| `Basket` | `src/pages/components/basket.ts` | Checkout, billing pages |
| `Header` | `src/pages/components/header.ts` | All pages |
-->

---

## Page Factory Pattern

Use a factory function to lazily instantiate page objects in tests:

```typescript
{{#if HAS_PAGE_FACTORY}}
// Use your project's page factory
import { createTestPages } from '{{PAGE_FACTORY_IMPORT}}'

const pages = createTestPages({ page })
pages.homePage      // → HomePage (created on first access)
pages.loginPage     // → LoginPage
pages.checkoutPage  // → CheckoutPage
{{/if}}
{{#if NO_PAGE_FACTORY}}
// Simple factory pattern
function createTestPages(page: Page) {
  return {
    get homePage() { return new HomePage(page) },
    get loginPage() { return new LoginPage(page) },
    get checkoutPage() { return new CheckoutPage(page) },
  }
}
{{/if}}
```

<!-- YOUR PROJECT: List your available page objects here -->

---

## Iframe Handling

If your application uses iframes (e.g. payment widgets, embedded forms), use `frameLocator`:

```typescript
// Accessing elements inside an iframe
readonly paymentFrame: FrameLocator
readonly cardNumberField: Locator

constructor(page: Page) {
  this.paymentFrame = page.frameLocator('iframe[title="Payment form"]')
  this.cardNumberField = this.paymentFrame.locator('input[data-fieldtype="cardNumber"]')
}
```

<!-- YOUR PROJECT: Document your iframe structure if applicable -->

---

## Method Conventions

| Pattern | Example | Usage |
|---------|---------|-------|
| `goto(url)` | `homePage.goto('/products')` | Navigate to a page |
| `expectXxx()` | `checkoutPage.expectOrderConfirmed()` | Assertions |
| `selectXxx()` | `productPage.selectSize('Large')` | User selections |
| `enterXxx()` | `loginPage.enterEmail('user@test.com')` | Form input |
| `clickXxx()` | `cartPage.clickCheckout()` | Button clicks |
| `waitForXxx()` | `resultsPage.waitForResults()` | Wait for state |

---

## Naming Conventions

- **Page files:** `{name}.page.ts` (in `{{PAGE_OBJECTS_DIR}}/`)
- **Component files:** `{name}.ts` (in `{{PAGE_OBJECTS_DIR}}/components/`)
- **Test files:** `{feature-name}.spec.ts` (in `{{TEST_DIR}}/`)
- **Helper files:** `{name}.ts` (in `src/helpers/`)

<!-- YOUR PROJECT: Adjust naming conventions to match your project structure -->
