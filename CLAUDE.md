# @vritti/api-sdk

Shared NestJS server SDK used by: vritti-cloud (cloud-server), vritti-core (core-server, commerce-service), voop (upcoming).

## Commands

```bash
pnpm build       # tsc --noEmit && tsup
pnpm lint        # Biome lint
pnpm check       # Biome check --write
```

## Critical Rules

### No `any` — ever

Never use `any` in this package. This is a shared SDK — `any` leaks through to every consumer.

- Use `unknown` when the type is truly indeterminate, then narrow with type guards.
- Import types from their source packages (e.g. `import type { MultipartFile } from '@fastify/multipart'`) rather than casting to `any`.
- If a third-party library lacks types, add a minimal type declaration — do not fall back to `any`.

### Exception System (RFC 9457)

See `.claude/rules/error-handling.md`. Exceptions use `ProblemOptions`:
- `label` — short heading (2-4 words, Title Case)
- `detail` — actionable sentence
- `errors[]` — field-specific errors (`{ field, message }`) for inline form display

### Export Conventions

- `export function` for services, hooks, utilities
- `export const` for components and constants

### Build Output

Entry points defined in `tsup.config.ts`: `src/index.ts`, `src/drizzle-orm.ts`, `src/drizzle-pg-core.ts`, `src/xlsx.ts`.

## Structure

```
src/
├── config/          # Configuration module
├── database/        # DatabaseModule, base repositories, shared DTOs
├── decorators/      # Parameter decorators (UploadedFile, etc.)
├── exceptions/      # RFC 9457 exception classes + HttpExceptionFilter
├── guards/          # Auth guards
├── brevo/           # Email service (Brevo)
├── redis/           # Redis module
└── index.ts         # Main barrel export
```
