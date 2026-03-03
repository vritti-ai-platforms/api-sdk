---
description: Backend controller conventions — thin HTTP layer, no business logic
globs: api-nexus/src/**/*.controller.ts
---

# Backend Controller Files

Controllers are a thin HTTP layer. They handle request/response concerns ONLY.

## Allowed in controllers

- Logging (`this.logger.log(...)`)
- Calling ONE service method and returning the result
- Fastify response operations (`reply.setCookie`, `reply.clearCookie`)
- Extracting values from request (headers, cookies) to pass to service

## NOT allowed in controllers

- Conditional logic / if-else branching on business rules
- Multiple service calls orchestrated together
- Data transformation / mapping (use DTOs in service layer)
- Throwing exceptions based on business logic (move to service)
- Array operations (`.find()`, `.filter()`, `.map()`)
- Direct database access

## One controller, one service

Each controller should inject ONLY its primary service (the service matching the controller name). If functionality from other services is needed, inject those services into the primary service, not the controller.

```typescript
// WRONG — multiple services injected in controller
@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly mobileVerificationService: MobileVerificationService,
  ) {}
}

// CORRECT — only primary service injected
@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
  ) {}
}

// OnboardingService handles delegation
@Injectable()
export class OnboardingService {
  constructor(
    private readonly emailVerificationService: EmailVerificationService,
    private readonly mobileVerificationService: MobileVerificationService,
  ) {}
}
```

## Pattern

```typescript
// WRONG — business logic in controller
@Delete('sessions/:id')
async revokeSession(@UserId() userId: string, @Param('id') sessionId: string, @Req() request: FastifyRequest) {
  const currentSession = await this.sessionService.validateAccessToken(accessToken);
  if (currentSession.id === sessionId) {
    throw new BadRequestException('Cannot revoke current session');
  }
  const sessions = await this.sessionService.getUserActiveSessions(userId);
  const targetSession = sessions.find((s) => s.id === sessionId);
  if (!targetSession) throw new NotFoundException('Session not found');
  await this.sessionService.invalidateSession(targetSession.accessToken);
  return { message: 'Session revoked' };
}

// CORRECT — all logic in service
@Delete('sessions/:id')
async revokeSession(@UserId() userId: string, @Param('id') sessionId: string, @Req() request: FastifyRequest) {
  this.logger.log(`DELETE /auth/sessions/${sessionId}`);
  const accessToken = request.headers.authorization?.replace('Bearer ', '') || '';
  return this.sessionService.revokeSessionById(userId, sessionId, accessToken);
}
```

## Use decorators for request data — no direct header/cookie access

```typescript
// WRONG — accessing request directly
async logout(@Req() request: FastifyRequest) {
  const accessToken = request.headers.authorization?.replace('Bearer ', '') || '';
}

// CORRECT — use @AccessToken() decorator from @vritti/api-sdk
async logout(@AccessToken() accessToken: string) { ... }
```

Available decorators from `@vritti/api-sdk`:
- `@UserId()` — extracts user ID from JWT (set by auth guard)
- `@AccessToken()` — extracts bearer token from Authorization header
- `@RefreshTokenCookie()` — extracts refresh token from httpOnly cookie
- `@Public()` — skips auth guard
- `@Onboarding()` — allows onboarding session tokens

Use `@Req()` only when no decorator exists (e.g., reading cookies by name).

## Async/await pattern — avoid unnecessary `return await`

Controllers should NOT use `await` before `return` when just passing through a service call. NestJS automatically awaits returned Promises.

```typescript
// WRONG — unnecessary await creates extra microtask
@Get('status')
async getStatus(@UserId() userId: string): Promise<StatusDto> {
  this.logger.log(`GET /auth/status - User: ${userId}`);
  return await this.authService.getStatus(userId);
}

// CORRECT — just return the Promise directly
@Get('status')
async getStatus(@UserId() userId: string): Promise<StatusDto> {
  this.logger.log(`GET /auth/status - User: ${userId}`);
  return this.authService.getStatus(userId);
}

// CORRECT — await IS needed when doing work after
@Post('set-password')
async setPassword(@UserId() userId: string, @Body() dto: SetPasswordDto): Promise<MessageDto> {
  this.logger.log(`POST /auth/set-password - User: ${userId}`);

  await this.authService.setPassword(userId, dto.password);

  return {
    success: true,
    message: 'Password set successfully',
  };
}
```

**Rule:** Only use `await` if you need to do work AFTER the async operation completes. Otherwise, return the Promise directly.

**Exception:** `return await` is allowed inside try-catch blocks for proper error handling.

## Import exceptions from `@vritti/api-sdk`

```typescript
// WRONG
import { BadRequestException } from '@nestjs/common';

// CORRECT
import { BadRequestException } from '@vritti/api-sdk';
```
