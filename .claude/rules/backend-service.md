---
description: Backend service layer conventions
globs: api-nexus/src/**/*.service.ts
---

# Backend Service Files

Services contain all business logic. They are the core of the application.

## Responsibilities

- Validate business rules and throw exceptions
- Orchestrate calls to repositories and other services
- Transform data between layers (entity → DTO)
- Handle cross-domain logic by calling other services

## Never access database directly

```typescript
// WRONG — direct Drizzle query in service
async findUser(email: string) {
  return this.db.select().from(users).where(eq(users.email, email));
}

// CORRECT — use repository
async findUser(email: string) {
  return this.userRepository.findByEmail(email);
}
```

## Exceptions from `@vritti/api-sdk`

```typescript
import { BadRequestException, UnauthorizedException, NotFoundException, ConflictException } from '@vritti/api-sdk';

// NOT from @nestjs/common
```

## Dependency injection via constructor

```typescript
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly encryptionService: EncryptionService,
  ) {}
}
```

Use `forwardRef()` only for circular dependencies.

## Return DTOs for API-facing methods

```typescript
// Public method (called by controller) — returns DTO
async findById(id: string): Promise<UserResponseDto> {
  const user = await this.userRepository.findById(id);
  if (!user) throw new NotFoundException('User not found.');
  return UserResponseDto.from(user);
}

// Internal method (called by other services) — returns entity
async findByEmail(email: string): Promise<User | undefined> {
  return this.userRepository.findByEmail(email);
}
```
