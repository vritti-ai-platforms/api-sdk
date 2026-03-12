---
description: Comment style for all TypeScript files (frontend and backend)
globs: auth-microfrontend/src/**/*.{ts,tsx}, cloud-microfrontend/src/**/*.{ts,tsx}, web-nexus/src/**/*.{ts,tsx}, api-nexus/src/**/*.ts
---

# Comment Style

## Use `//` for all comments — no JSDoc `/** */`

```typescript
// WRONG
/** Authenticates a user with email and password */
async login(dto: LoginDto) { ... }

// CORRECT
// Authenticates a user with email and password
async login(dto: LoginDto) { ... }
```

One sentence, starts with a verb. No `@param`, `@returns`, `@throws`, `@example`.

Exception: `@deprecated` tags are allowed as `/** @deprecated Use X instead */`.

## Every method gets a one-liner `//` comment

```typescript
// Creates a new user account and initiates onboarding
@Post('signup')
@Public()
@ApiSignup()
async signup(...) { ... }

// Validates credentials and creates session, or returns MFA challenge
async login(dto: LoginDto, ipAddress?: string) { ... }

// Finds active sessions ordered by most recent
async findActiveByUserId(userId: string) { ... }
```

Skip constructors and trivial getters.

## Inline `//` above non-obvious logic blocks

```typescript
// Store access token in memory and schedule proactive refresh
useEffect(() => {

// Set refresh token in httpOnly cookie
reply.setCookie(getRefreshCookieName(), refreshToken, getRefreshCookieOptionsFromConfig());
```

## No comments on interfaces, types, enums, classes, or constants

```typescript
// WRONG
// User login data transfer object
export interface LoginDto { ... }

// CORRECT — the name is the documentation
export interface LoginDto { ... }
```

## No field comments on interfaces

```typescript
// WRONG
export interface LoginResponse {
  // Access token for API requests
  accessToken?: string;
}

// CORRECT
export interface LoginResponse {
  accessToken?: string;
}
```

## No multi-line comment blocks

```typescript
// WRONG
/**
 * Hook to access authentication context
 *
 * @returns AuthContextValue containing user data
 * @throws Error if used outside of AuthProvider
 */

// WRONG
// Hook to access authentication context
// Returns AuthContextValue containing user data
// Throws Error if used outside of AuthProvider

// CORRECT
// Hook to access auth state — must be used within AuthProvider
```

## Imports — types first

Within an import statement, `type` imports come before value imports:

```typescript
// WRONG
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';

// CORRECT
import { type UseMutationOptions, useMutation } from '@tanstack/react-query';
```

Biome enforces this automatically.
