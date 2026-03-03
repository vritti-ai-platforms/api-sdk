---
description: Export style conventions for functions, components, and values
globs: "**/*.{ts,tsx}"
---

# Export Conventions

## `export function` for all functions

Services, hooks, utilities, helpers — use function declarations.

```typescript
// WRONG
export const login = (data: LoginDto): Promise<LoginResponse> => { ... }
export const useLogin = (options?: UseLoginOptions) => { ... }

// CORRECT
export function login(data: LoginDto): Promise<LoginResponse> { ... }
export function useLogin(options?: UseLoginOptions) { ... }
```

## `export const` for components and values

React components, constants, query keys, configuration objects.

```typescript
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => { ... }
export const PROFILE_QUERY_KEY = ['profile'] as const;
export const ALL_REMOTES: RemoteConfig[] = [ ... ];
```

## Summary

| What | Pattern |
|------|---------|
| Services | `export function login()` |
| Hooks | `export function useLogin()` |
| Utilities | `export function cn()` |
| Components | `export const LoginPage = () =>` |
| Constants | `export const QUERY_KEY = [...]` |
