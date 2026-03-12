---
description: Backend module folder structure and conventions
paths:
  - "src/modules/**/*.ts"
---

# Backend Module Structure

## One module.ts per top-level module only

Submodules are folders for code organization, NOT NestJS modules. All controllers, services, and providers are registered in the parent module.ts.

```typescript
// WRONG — submodule has own module.ts
@Module({ imports: [forwardRef(() => AuthModule)] })
export class MfaVerificationModule {}

// CORRECT — parent module registers everything
@Module({
  controllers: [AuthController, MfaVerificationController, PasskeyAuthController],
  providers: [AuthService, MfaVerificationService, PasskeyAuthService, ...],
})
export class AuthModule {}
```

## DTOs organized in subfolders

```
dto/
├── request/    # Incoming — class-validator + @ApiProperty
├── response/   # API return types — @ApiProperty
└── entity/     # Entity transforms — static from()
```

See `backend-dto.md` for full conventions.

## Always use folders, never flat files

```
// WRONG
tenant/
├── tenant.module.ts
├── tenant.controller.ts
├── tenant.service.ts
└── tenant.repository.ts

// CORRECT
tenant/
├── tenant.module.ts
├── controllers/
│   └── tenant.controller.ts
├── services/
│   └── tenant.service.ts
├── repositories/
│   └── tenant.repository.ts
├── dto/
└── docs/
```

## Simple modules — folders at root

When a module has no sub-paths needing their own service/repo:

```
user/
├── user.module.ts
├── controllers/
├── services/
├── repositories/
├── dto/
└── docs/
```

## Complex modules — root/ + submodule folders

When a module has sub-paths with their own services:

```
auth/
├── auth.module.ts              # Only file at module root
├── root/                       # /auth/* base routes
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── dto/
│   └── docs/
├── oauth/                      # /auth/oauth/*
│   ├── controllers/
│   ├── services/
│   ├── providers/
│   ├── repositories/
│   ├── dto/
│   └── docs/
├── passkey/                    # /auth/passkey/*
│   ├── controllers/
│   ├── services/
│   ├── dto/
│   └── docs/
└── mfa-verification/           # /auth/mfa/*
    ├── controllers/
    ├── services/
    ├── dto/
    └── docs/
```

## When to create a submodule folder

A sub-path gets its own folder when it has its own service + repository (complex enough). Otherwise the controller stays in the parent's `controllers/` folder.

## Module.ts imports organized by submodule

```typescript
@Module({
  imports: [ServicesModule, forwardRef(() => UserModule)],
  controllers: [AuthController, AuthOAuthController, PasskeyAuthController, MfaVerificationController],
  providers: [
    // Root
    AuthService, SessionService, SessionRepository,
    // OAuth
    OAuthService, OAuthStateService, OAuthProviderRepository,
    // Passkey
    PasskeyAuthService,
    // MFA verification
    MfaVerificationService, MfaChallengeStore,
  ],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
```

## Naming

| File type | Pattern | Example |
|-----------|---------|---------|
| Module | `<module>.module.ts` | `auth.module.ts` |
| Controller | `<path-segment>.controller.ts` | `auth.controller.ts` |
| Service | `<domain>.service.ts` | `session.service.ts` |
| Repository | `<entity>.repository.ts` | `session.repository.ts` |
| Request DTO | `<action>.dto.ts` | `login.dto.ts` |
| Response DTO | `<entity>-response.dto.ts` | `auth-response.dto.ts` |
| Docs | `<controller-name>.docs.ts` | `auth.docs.ts` |
