---
description: Frontend hook file conventions
globs: auth-microfrontend/src/hooks/**/*.ts, cloud-microfrontend/src/hooks/**/*.ts, cloud-microfrontend/src/features/**/hooks/**/*.ts, web-nexus/src/hooks/**/*.ts
---

# Frontend Hook Files

Hooks are thin wrappers around services using TanStack Query.

## Use `AxiosError` for error type — not `Error`

All mutations and queries use axios under the hood. Use `AxiosError` so `error.response?.status` and `error.response?.data` are properly typed.

```typescript
// WRONG — error.response is untyped
useMutation<LoginResponse, Error, LoginDto>({ ... });

// CORRECT — error.response?.status works without casting
import type { AxiosError } from 'axios';
useMutation<LoginResponse, AxiosError, LoginDto>({ ... });
```

## Use `export function`, not `export const`

```typescript
// WRONG
export const useLogin = (options?: UseLoginOptions) => {
  return useMutation<LoginResponse, AxiosError, LoginDto>({ ... });
};

// CORRECT
export function useLogin(options?: UseLoginOptions) {
  return useMutation<LoginResponse, AxiosError, LoginDto>({ ... });
}
```

## Use direct function references for mutationFn/queryFn

When the service function signature matches what TanStack Query expects, pass it directly.

```typescript
// WRONG — redundant wrapper
mutationFn: (data: LoginDto) => login(data),
queryFn: () => getProfile(),

// CORRECT — direct reference
mutationFn: login,
queryFn: getProfile,
```

Exception: destructuring params or multi-step async logic:
```typescript
mutationFn: ({ email, otp }) => verifyResetOtp(email, otp),

mutationFn: async (sessionId) => {
  const { options } = await startPasskeyVerification(sessionId);
  const credential = await startAuthentication({ optionsJSON: options });
  return await verifyPasskeyMfa(sessionId, credential);
},
```

## Options type pattern

```typescript
type UseLoginOptions = Omit<UseMutationOptions<LoginResponse, AxiosError, LoginDto>, 'mutationFn'>;
```

## Query keys — hierarchical arrays

```typescript
['auth', 'user']
['profile']
['sessions']
['mobile-verification', 'status']
['conversations']
```

## Constants as `export const`

```typescript
export const PROFILE_QUERY_KEY = ['profile'] as const;
export const SESSIONS_QUERY_KEY = ['sessions'] as const;
```
