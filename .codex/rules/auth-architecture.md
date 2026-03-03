---
description: Auth system architecture facts and constraints
globs: api-nexus/src/modules/cloud-api/auth/**/*.ts
---

# Auth Architecture

These are established facts. Do NOT change these patterns without explicit approval.

## Password & Encryption
- Password hashing: **Argon2id** via EncryptionService (NOT bcrypt)

## Sessions & Tokens
- Token recovery: `GET /cloud-api/auth/token` (NOT POST)
- ONBOARDING session: 24h expiry (NOT 10 min)
- Refresh token: httpOnly cookie only (NOT in response body)
- JWT payload: `{ userId, type, refreshTokenHash }` (NOT sub/email/sessionType)
- sameSite cookie: `strict` (NOT lax)

## OAuth
- OAuth state: PostgreSQL `oauth_states` table (NOT Redis)

## MFA
- MFA challenge store: in-memory Map (NOT database)

## Cookie Configuration
- Cookie name from `REFRESH_COOKIE_NAME` env var (default: `vritti_refresh`)
- Cookie domain from `REFRESH_COOKIE_DOMAIN` env var
- Use `getRefreshCookieName()` and `getRefreshCookieOptionsFromConfig()` helpers
