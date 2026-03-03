---
description: Swagger/OpenAPI documentation pattern for API controllers
globs: api-nexus/src/**/*.controller.ts, api-nexus/src/**/docs/*.docs.ts
---

# Swagger Documentation Pattern

Swagger decorators live in separate `docs/` files, NOT inline on controllers.

## Structure

Each module has a `docs/` folder with `*.docs.ts` files:
```
module/
├── controllers/
│   └── example.controller.ts    ← clean, uses @ApiExample()
├── docs/
│   └── example.docs.ts          ← Swagger decorators composed here
```

Submodules (like `mfa-verification/`) co-locate their docs file in the submodule folder.

## docs file pattern

```typescript
import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExampleDto } from '../dto/example.dto';

export function ApiCreateExample() {
  return applyDecorators(
    ApiOperation({ summary: 'Create example', description: '...' }),
    ApiBody({ type: ExampleDto }),
    ApiResponse({ status: 201, description: '...' }),
    ApiResponse({ status: 400, description: '...' }),
  );
}
```

## Controller usage

```typescript
import { ApiCreateExample } from '../docs/example.docs';

@ApiTags('Examples')
@Controller('examples')
export class ExampleController {
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateExample()
  async create(@Body() dto: ExampleDto) { ... }
}
```

## ApiResponse must use `type:` — no inline schemas

```typescript
// WRONG — inline schema
ApiResponse({
  status: 200,
  schema: {
    type: 'object',
    properties: {
      accessToken: { type: 'string' },
      expiresIn: { type: 'number' },
    },
  },
})

// CORRECT — reference the response DTO
ApiResponse({ status: 200, description: 'Token recovered.', type: TokenResponse })
```

Import response DTOs from `dto/response/` and entity DTOs from `dto/entity/`.

## Rules

- **Naming**: `Api` + PascalCase method name (e.g., `ApiSignup`, `ApiGetToken`, `ApiForgotPassword`)
- **Class-level stays on controller**: `@ApiTags()`, `@ApiBearerAuth()` (when all endpoints need it)
- **Method-level goes to docs**: `@ApiOperation`, `@ApiBody`, `@ApiResponse`, `@ApiParam`, `@ApiQuery`, `@ApiHeader`, `@ApiProduces`
- **Method-level `@ApiBearerAuth()`** goes to docs when only some endpoints need it
- **ApiResponse `type:`** must reference a response DTO class — no inline `schema:` objects
- When adding a new endpoint, ALWAYS create the doc decorator in the `docs/` file first
- One function per endpoint, one file per controller
