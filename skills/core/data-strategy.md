# Data Strategy — Static vs Dynamic Test Data

## Bifurcated Approach

Test data falls into two categories, each with a clear purpose. Mixing them leads to flaky tests (hardcoded data colliding in parallel) or over-engineering (factories for static boundary values).

---

## Static Data

**What:** JSON files or TypeScript constants containing fixed, version-controlled values.

**When to use:**
- Boundary values and edge cases (empty strings, max-length inputs, special characters)
- Invalid inputs for negative testing (malformed emails, expired dates)
- Known error messages or validation text to assert against
- Reference data that never changes (country codes, currency symbols)
- Test card numbers and promo codes

**Characteristics:**
- Immutable within a test run
- Shared safely across parallel tests (read-only)
- Version-controlled — changes are visible in diffs
- Lives in dedicated data files, not inline in tests

### Example structure

```
src/test-data/
├── test-cards.ts        # Payment card numbers
├── guest-users.ts       # Guest checkout data
├── strings/
│   └── us-strings.ts    # Expected UI text
├── invalid-inputs.ts    # Boundary/edge case values
└── promocodes.ts        # Staging promo codes
```

### Example

```typescript
// src/test-data/invalid-inputs.ts
export const invalidEmails = [
  '',
  'not-an-email',
  '@no-local-part.com',
  'spaces in@email.com',
  'a'.repeat(255) + '@toolong.com'
] as const

export const invalidPhoneNumbers = [
  '',
  '123',           // too short
  'not-a-number',
  '+1-555-555-55555' // too long
] as const
```

---

## Dynamic Factories

**What:** Functions that generate unique test data per invocation, using libraries like `@faker-js/faker`.

**When to use:**
- Happy-path user data (names, emails, addresses) that must be unique per test
- Data that could collide when tests run in parallel
- Any data where the specific value doesn't matter, only the shape does
- User creation, order placement, or any write operation

**Characteristics:**
- Unique per call — safe for parallel execution
- Accepts overrides for specific test scenarios
- Returns typed objects matching the expected API/form shape
- Optionally validated with Zod schemas

> **Note:** `@faker-js/faker` is an optional dependency. The pattern below works with any data generation approach.

### Factory Pattern Template

```typescript
import { faker } from '@faker-js/faker'

interface UserData {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export function generateUser(overrides: Partial<UserData> = {}): UserData {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email({ provider: 'test.example.com' }),
    phone: faker.phone.number({ style: 'national' }),
    ...overrides
  }
}
```

### Usage in tests

```typescript
// Fully random user — unique per test run
const user = generateUser()

// Override specific fields for a targeted scenario
const user = generateUser({ email: 'specific@test.com' })

// Combine with Zod validation (optional)
const user = UserSchema.parse(generateUser())
```

---

## Decision Criteria

| Criterion | Static Data | Dynamic Factory |
|-----------|-------------|-----------------|
| Value matters to the assertion | Yes — use static | No — use factory |
| Used in parallel tests that write data | No — risk of collision | Yes — unique per call |
| Boundary/edge case testing | Yes — curated values | No — random misses edges |
| Negative testing (invalid inputs) | Yes — known invalid values | No — faker generates valid data |
| User registration / order creation | No — will collide | Yes — unique identifiers |
| Expected UI text / error messages | Yes — exact match needed | No — not applicable |
| Read-only reference data | Yes — shared safely | Overkill — use static |

### Rule of thumb

> If you're **asserting the exact value**, use static data.
> If you're **filling a form to proceed**, use a factory.
