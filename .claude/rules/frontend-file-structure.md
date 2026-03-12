---
description: Frontend file organization — modular directories, no flat duplicates
globs: auth-microfrontend/src/**/*.ts, cloud-microfrontend/src/**/*.ts, web-nexus/src/**/*.ts
---

# Frontend File Structure

## Hooks mirror pages structure

One hook per file, organized in domain directories that mirror the `pages/` structure. Every directory has a barrel `index.ts`.

```
// CORRECT — hooks mirror pages domains
hooks/
├── auth/                           ← matches pages/auth/
│   ├── useLogin.ts
│   ├── useSignup.ts
│   ├── useMFAVerification.ts      ← login MFA challenge flow
│   └── index.ts
├── onboarding/                     ← matches pages/onboarding/
│   ├── useSendEmailOtp.ts
│   ├── useVerifyEmail.ts
│   ├── useSetPassword.ts
│   ├── mfa/                        ← submodule for MFA setup step
│   │   ├── useMFA.ts
│   │   └── index.ts
│   ├── mobile-verification/        ← submodule for mobile step
│   │   ├── useInitiateMobileVerification.ts
│   │   ├── useVerifyMobileOtp.ts
│   │   └── index.ts
│   └── index.ts
├── password-reset/                 ← matches pages/auth/password-reset/
│   ├── useForgotPassword.ts
│   └── index.ts
├── settings/                       ← matches pages/settings/
│   ├── useProfile.ts
│   ├── useSecurity.ts
│   ├── useEmailChangeFlow.ts
│   └── index.ts
└── index.ts                        ← comment-only (see Import Path Conventions)

// WRONG — flat files at root instead of in domain folder
hooks/
├── auth/
│   └── useLogin.ts
├── useProfile.ts                   ← should be in settings/
├── useSecurity.ts                  ← should be in settings/
├── useEmailChangeFlow.ts           ← should be in settings/

// WRONG — hook in wrong domain folder
hooks/
├── auth/
│   └── useMFA.ts                   ← MFA setup is onboarding, not auth
├── onboarding/
│   └── useMFAVerification.ts       ← MFA challenge is auth, not onboarding
```

**Placement rule:** a hook belongs to the domain where its UI lives. MFA *setup* is an onboarding step → `onboarding/mfa/`. MFA *verification* during login → `auth/`.

Never have both `hooks/auth.ts` and `hooks/auth/index.ts` — TypeScript resolves the file over the directory.

## Submodule folders in hooks

A hook directory gets a submodule folder when the page has a distinct sub-step with its own hooks (e.g., `onboarding/mfa/`, `onboarding/mobile-verification/`). The submodule barrel re-exports to the parent barrel.

```typescript
// onboarding/index.ts — re-exports submodules
export { useInitiateTotpSetup, useSkipMFASetup } from './mfa';
export { useInitiateMobileVerification, useVerifyMobileOtp } from './mobile-verification';
export { useChangeEmail } from './useChangeEmail';
```

## Services — one file per domain

```
services/
├── auth.service.ts
├── onboarding.service.ts
├── settings.service.ts
├── verification.service.ts
└── index.ts                ← comment-only (see Import Path Conventions)
```

## Import Path Conventions

Always import from the most specific path available. **Never use top-level barrel imports.**

The import path is documentation — `@hooks/onboarding/mfa` immediately tells a developer the hook belongs to the onboarding flow, MFA sub-step, without opening any file.

Top-level barrel files (`hooks/index.ts`, `services/index.ts`) are intentionally comment-only.

### Path alias reference

| What you need | Correct import | Wrong |
|--------------|----------------|-------|
| Auth hooks | `@hooks/auth` | `@hooks` |
| Onboarding MFA hooks | `@hooks/onboarding/mfa` | `@hooks/onboarding` |
| Mobile verification hooks | `@hooks/onboarding/mobile-verification` | `@hooks` |
| Password reset hooks | `@hooks/password-reset` | `@hooks` |
| Settings hooks | `@hooks/settings` | `@hooks` |
| Auth service | `@services/auth.service` | `@services` |
| Onboarding service | `@services/onboarding.service` | `@services` |
| Settings service | `@services/settings.service` | `@services` |
| Verification service | `@services/verification.service` | `@services` |
| Auth schemas/types | `@schemas/auth` | barrel |
| Settings schemas/types | `@schemas/settings` | barrel |
| Onboarding context | `@context/onboarding` | `@context` |
| Individual component | `@components/auth/AuthDivider` | `@components/auth/mfa-verification` barrel |

```typescript
// WRONG — barrel hides where the code lives
import { useLogin, useSignup } from '@hooks';
import { login } from '@services';

// CORRECT — path tells you exactly where the code lives
import { useLogin, useSignup } from '@hooks/auth';
import { login } from '@services/auth.service';
```

## Barrel exports — domain barrels only

Domain barrel `index.ts` files re-export within their folder only — never up to a parent barrel.

```typescript
// hooks/onboarding/index.ts — re-exports submodules to onboarding level
export { useInitiateTotpSetup, useSkipMFASetup } from './mfa';
export { useInitiateMobileVerification, useVerifyMobileOtp } from './mobile-verification';
export { useChangeEmail } from './useChangeEmail';
```

Types first in re-exports:
```typescript
export { type PasswordResetFlow, type Step, useForgotPassword } from './password-reset';
```
