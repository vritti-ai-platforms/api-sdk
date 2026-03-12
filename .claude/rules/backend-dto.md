---
description: Backend DTO conventions — request, response, and entity DTOs
paths:
  - "src/**/dto/**/*.ts"
---

# Backend DTO Structure

## Three categories inside `dto/`

```
dto/
├── request/       # Incoming data (validated by class-validator)
│   ├── login.dto.ts
│   └── signup.dto.ts
├── response/      # API return types (documented by @ApiProperty)
│   ├── login-response.dto.ts
│   └── token-response.dto.ts
└── entity/        # Entity transformations (strip sensitive fields)
    └── session-response.dto.ts
```

## Request DTOs

- Have `class-validator` decorators (`@IsEmail`, `@IsString`, `@MinLength`)
- Have `@ApiProperty` for Swagger request body docs
- Named: `<Action>Dto` (e.g., `LoginDto`, `SignupDto`, `ChangePasswordDto`)

```typescript
export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  @MinLength(8)
  password: string;
}
```

## Response DTOs

- Have `@ApiProperty` for Swagger response docs
- Named: `<Name>ResponseDto` (e.g., `LoginResponseDto`, `TokenResponseDto`, `MessageResponseDto`), file named `<name>-response.dto.ts`
- NO `static from()` — they don't transform entities
- Used as controller method return types: `): Promise<LoginResponseDto>`

```typescript
export class LoginResponseDto {
  @ApiPropertyOptional()
  accessToken?: string;

  @ApiPropertyOptional()
  expiresIn?: number;

  @ApiPropertyOptional()
  requiresMfa?: boolean;
}
```

## Entity DTOs

- Have `static from()` to transform database entities
- Strip sensitive fields (passwordHash, secrets, etc.)
- Named: `<Entity>Dto` — NO "Response" in name (e.g., `UserDto`, `TenantDto`)
- Named with "Response" if directly returned from an API endpoint (e.g., `SessionResponse`)

```typescript
export class UserDto {
  id: string;
  email: string;
  hasPassword: boolean;
  // passwordHash excluded

  static from(user: User): UserDto { ... }
}
```

## Response DTOs must live in the same module as the endpoint

Never import a response DTO from another module. Each endpoint's return type must be defined in its own module's `dto/response/` folder.

```typescript
// WRONG — auth controller returning onboarding module's DTO
import { OnboardingStatusResponseDto } from '../../../onboarding/root/dto/entity/onboarding-status-response.dto';
async signup(): Promise<OnboardingStatusResponseDto> { ... }

// CORRECT — auth controller returns its own SignupResponseDto
import { SignupResponseDto } from '../dto/response/signup-response.dto';
async signup(): Promise<SignupResponseDto> { ... }
```

If two modules need similar data, create separate response DTOs in each module. The service can build the response from shared entity DTOs or services.

## Controller methods must have explicit return types

```typescript
// WRONG — no return type
async login(@Body() dto: LoginDto) { ... }

// CORRECT — explicit Promise<ResponseDto>
async login(@Body() dto: LoginDto): Promise<LoginResponseDto> { ... }
```

## Common shared response types

Reusable response shapes for simple endpoints:
- `MessageResponseDto` — `{ message: string }`
- `SuccessResponseDto` — `{ success: boolean; message: string }`
- `TokenResponseDto` — `{ accessToken: string; expiresIn: number }`
