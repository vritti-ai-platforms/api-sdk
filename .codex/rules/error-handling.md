---
description: RFC 9457 error handling patterns for API exceptions
globs: api-nexus/src/**/*.ts
---

# Error Handling — RFC 9457 Problem Details

Import exceptions from `@vritti/api-sdk`, NOT `@nestjs/common`.

```typescript
import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@vritti/api-sdk';
```

## Patterns

**Simple string** — general errors without field context:
```typescript
throw new UnauthorizedException('Invalid email or password.');
throw new NotFoundException('User not found.');
```

**Field + message** — form field validation:
```typescript
throw new BadRequestException('email', 'Invalid email format');
```

**ProblemOptions** — rich errors with heading + detail + field errors:
```typescript
throw new BadRequestException({
  label: 'Invalid Code',           // → AlertTitle (short, Title Case)
  detail: 'The verification code you entered is incorrect.',  // → AlertDescription
  errors: [{ field: 'code', message: 'Invalid code' }],      // → inline on form field
});
```

## Quality Rules

1. **label and detail must NOT repeat each other** — detail adds actionable info beyond the label
2. **`errors[].message` must be SHORT (2-5 words)** — never duplicates detail
3. **Every ProblemOptions with `errors[]` MUST have a `label`** — otherwise UI shows generic "Bad Request"
4. **One error per field** — no duplicate field entries
5. **Don't use ProblemOptions for simple cases** — `throw new NotFoundException('User not found.')` is fine
6. **`errors[].field` must match an actual form field name** — otherwise the error is silently lost

## When to Use Each

| Scenario | Pattern |
|----------|---------|
| Login failure | `throw new UnauthorizedException('Invalid email or password.')` |
| Session expired | `throw new UnauthorizedException('Session expired.')` |
| Resource not found | `throw new NotFoundException('User not found.')` |
| Form field error with heading | `{ label: '...', detail: '...', errors: [{ field, message }] }` |
| Rich error with heading (no field) | `{ label: '...', detail: '...' }` |
| Duplicate resource (signup, create) | `throw new ConflictException({ label: '...', detail: '...' })` |

## Frontend — check status code, not error strings

```typescript
// WRONG — fragile string matching
if (errorMessage.includes('already exists')) { ... }

// CORRECT — check HTTP status from AxiosError
onError: (error) => {
  setShowLoginButton(error.response?.status === 409);
}
```
