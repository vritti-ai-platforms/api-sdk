# @vritti/api-sdk

NestJS SDK for multi-tenant applications with automatic database routing, JWT authentication, and request-scoped tenant context management.

[![npm version](https://img.shields.io/npm/v/@vritti/api-sdk.svg)](https://www.npmjs.com/package/@vritti/api-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🏢 **Multi-tenant Database Management**: Automatic tenant routing with connection pooling
- 🔐 **JWT Authentication**: Built-in auth guard with refresh token validation
- 🌐 **Gateway & Microservice Support**: Optimized for both HTTP APIs and RabbitMQ workers
- 🎯 **Request-Scoped Context**: Tenant information available throughout the request lifecycle
- 🛡️ **Decorators**: `@Public()`, `@Onboarding()`, and `@Tenant()` for flexible access control
- ⚡ **Zero Configuration**: Auto-registers guards and interceptors
- 📝 **Unified Logging**: Environment-aware logging with PII masking, correlation IDs, and multi-tenant context

## Installation

```bash
# npm
npm install @vritti/api-sdk @nestjs/jwt @nestjs/config @prisma/client

# yarn
yarn add @vritti/api-sdk @nestjs/jwt @nestjs/config @prisma/client

# pnpm
pnpm add @vritti/api-sdk @nestjs/jwt @nestjs/config @prisma/client
```

## Quick Start

### Gateway Mode (HTTP API)

For REST APIs and GraphQL gateways that serve HTTP requests:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { AuthConfigModule, DatabaseModule } from '@vritti/api-sdk';

@Module({
  imports: [
    // Environment configuration
    ConfigModule.forRoot({ isGlobal: true }),

    // Multi-tenant database (Gateway mode)
    DatabaseModule.forServer({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        primaryDb: {
          host: config.get('PRIMARY_DB_HOST'),
          port: config.get('PRIMARY_DB_PORT'),
          username: config.get('PRIMARY_DB_USERNAME'),
          password: config.get('PRIMARY_DB_PASSWORD'),
          database: config.get('PRIMARY_DB_DATABASE'),
        },
        prismaClientConstructor: PrismaClient,
      }),
    }),

    // JWT authentication
    AuthConfigModule.forRootAsync(),
  ],
})
export class AppModule {}
```

### Microservice Mode (RabbitMQ Workers)

For microservices that process messages from queues:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { AuthConfigModule, DatabaseModule } from '@vritti/api-sdk';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Multi-tenant database (Microservice mode)
    DatabaseModule.forMicroservice({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        prismaClientConstructor: PrismaClient,
      }),
    }),

    AuthConfigModule.forRootAsync(),
  ],
})
export class AppModule {}
```

## Environment Variables

### Required for All Modes

```bash
JWT_SECRET=your-access-token-secret-key
```

### Required for Gateway Mode

```bash
# Primary database (tenant registry)
PRIMARY_DB_HOST=localhost
PRIMARY_DB_PORT=5432
PRIMARY_DB_USERNAME=postgres
PRIMARY_DB_PASSWORD=postgres
PRIMARY_DB_DATABASE=vritti_primary
PRIMARY_DB_SCHEMA=public

# Optional
JWT_REFRESH_SECRET=your-refresh-token-secret-key
PRIMARY_DB_SSL_MODE=prefer  # Options: require, prefer, disable
```

## Usage Examples

### Public Endpoints

Use `@Public()` to bypass authentication:

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { Public } from '@vritti/api-sdk';

@Controller('auth')
export class AuthController {
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    // No authentication required
    return this.authService.login(dto);
  }
}
```

### Onboarding Endpoints

Use `@Onboarding()` for registration/verification flows:

```typescript
import { Controller, Post, Request } from '@nestjs/common';
import { Onboarding } from '@vritti/api-sdk';

@Controller('onboarding')
export class OnboardingController {
  @Onboarding()
  @Post('verify-email')
  async verifyEmail(@Request() req) {
    const userId = req.user.id; // Available from auth guard
    return this.onboardingService.verifyEmail(userId);
  }
}
```

### Accessing Tenant Information

Use `@Tenant()` to inject tenant metadata:

```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';
import { Tenant, TenantInfo } from '@vritti/api-sdk';

@Controller('users')
export class UsersController {
  @Get('info')
  async getTenantInfo(@Tenant() tenant: TenantInfo) {
    return {
      id: tenant.id,
      subdomain: tenant.subdomain,
      type: tenant.type, // STARTER, PROFESSIONAL, ENTERPRISE
    };
  }

  @Post()
  async createUser(
    @Body() dto: CreateUserDto,
    @Tenant() tenant: TenantInfo,
  ) {
    this.logger.log(`Creating user for tenant: ${tenant.subdomain}`);
    // Tenant-specific logic
    if (tenant.type === 'ENTERPRISE') {
      // Enable enterprise features
    }
    return this.usersService.create(dto);
  }
}
```

### Using Tenant Database Service

Access tenant-specific database connections:

```typescript
import { Injectable } from '@nestjs/common';
import { TenantDatabaseService } from '@vritti/api-sdk';

@Injectable()
export class UsersService {
  constructor(
    private readonly tenantDb: TenantDatabaseService,
  ) {}

  async findAll() {
    // Automatically uses tenant's database
    const db = await this.tenantDb.getClient();
    return db.user.findMany();
  }

  async create(data: CreateUserDto) {
    const db = await this.tenantDb.getClient();
    return db.user.create({ data });
  }
}
```

### Using Base Repositories

The SDK provides base repository classes for common CRUD operations with automatic tenant scoping:

#### Primary Database Repositories

For entities in the primary/platform database (tenants, users, sessions, etc.):

```typescript
import { Injectable } from '@nestjs/common';
import { PrimaryBaseRepository, PrimaryDatabaseService } from '@vritti/api-sdk';
import { User, CreateUserDto, UpdateUserDto } from './types';

@Injectable()
export class UserRepository extends PrimaryBaseRepository<
  User,
  CreateUserDto,
  UpdateUserDto
> {
  constructor(database: PrimaryDatabaseService) {
    // Use model delegate pattern - type-safe with IDE autocomplete!
    super(database, (prisma) => prisma.user);
  }

  // Add custom methods as needed
  async findByEmail(email: string): Promise<User | null> {
    return this.model.findUnique({ where: { email } });
  }

  async findActiveUsers(): Promise<User[]> {
    return this.model.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

#### Tenant Database Repositories

For tenant-scoped entities (products, orders, customers, etc.):

```typescript
import { Injectable } from '@nestjs/common';
import { TenantBaseRepository, TenantDatabaseService } from '@vritti/api-sdk';
import { Product, CreateProductDto, UpdateProductDto } from './types';

@Injectable()
export class ProductRepository extends TenantBaseRepository<
  Product,
  CreateProductDto,
  UpdateProductDto
> {
  constructor(database: TenantDatabaseService) {
    // Short syntax is also supported
    super(database, (p) => p.product);
  }

  // Custom methods for product-specific queries
  async findBySku(sku: string): Promise<Product | null> {
    return this.model.findUnique({ where: { sku } });
  }

  async findInStock(): Promise<Product[]> {
    return this.model.findMany({
      where: { quantity: { gt: 0 } },
    });
  }
}
```

#### Available Base Repository Methods

Both `PrimaryBaseRepository` and `TenantBaseRepository` provide these methods:

```typescript
// Create
await repository.create(data);

// Read
await repository.findById(id);
await repository.findOne({ where: { email } });
await repository.findMany({ where: { status: 'ACTIVE' } });

// Update
await repository.update(id, data);
await repository.updateMany({ status: 'PENDING' }, { status: 'ACTIVE' });

// Delete
await repository.delete(id);
await repository.deleteMany({ status: 'INACTIVE' });

// Count & Exists
await repository.count({ status: 'ACTIVE' });
await repository.exists({ email: 'user@example.com' });
```

#### Benefits of the Model Delegate Pattern

```typescript
// ✅ Type-safe with IDE autocomplete
super(database, (prisma) => prisma.user);

// ✅ Refactor-friendly - TypeScript errors if model name changes
super(database, (p) => p.emailVerification);

// ✅ Works with complex model names
super(database, (p) => p.inventoryItem);

// ✅ No hardcoded strings
// ❌ Old way: super(database, 'user')  // Error-prone!
```

## Architecture

### Gateway Mode (`forServer()`)

**How it works:**
1. HTTP request arrives with tenant identifier (subdomain or `x-tenant-id` header)
2. `TenantContextInterceptor` extracts tenant identifier
3. `PrimaryDatabaseService` queries tenant registry for configuration
4. `VrittiAuthGuard` validates JWT tokens and tenant status
5. Tenant context is available throughout the request via `TenantContextService`

**Tenant Resolution:**
- Primary: Subdomain (`acme.api.vritti.com` → `acme`)
- Fallback: `x-tenant-id` header

### Microservice Mode (`forMicroservice()`)

**How it works:**
1. RabbitMQ message arrives with embedded tenant information
2. `MessageTenantContextInterceptor` extracts tenant from message payload
3. Tenant context is set in `TenantContextService`
4. No primary database lookup needed (tenant info comes from gateway)

**Expected Message Format:**
```typescript
{
  dto: { /* your data */ },
  tenant: {
    id: 'tenant-uuid',
    subdomain: 'acme',
    type: 'ENTERPRISE',
    databaseHost: 'tenant-db.aws.com',
    databaseName: 'acme_db',
    // ... other config
  }
}
```

## Unified Logging

The SDK provides a comprehensive logging system with built-in support for correlation IDs, HTTP logging, and multi-tenant context tracking. Choose between NestJS default logger or Winston with environment-based presets.

### Features

- 🎯 **Dual Provider Support**: Switch between NestJS default Logger and Winston
- 🌍 **Environment Presets**: Pre-configured settings for development, staging, production, and test
- 🔗 **Correlation IDs**: Track requests across services with automatic ID generation and propagation
- 🏢 **Multi-Tenant Context**: Automatically includes tenant and user IDs in logs
- 📁 **File Logging**: Automatic file rotation with configurable retention
- 🚀 **HTTP Request/Response Logging**: Automatic logging of all HTTP traffic
- ⚡ **Zero Configuration**: Works out of the box with sensible defaults

### Quick Start

Import the `LoggerModule` in your application:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from '@vritti/api-sdk';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Option 1: Simple configuration with environment preset
    LoggerModule.forRoot({
      environment: 'development',  // Required: development, staging, production, test
      appName: 'my-service',
    }),

    // Option 2: Dynamic configuration with ConfigService
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        environment: config.get('NODE_ENV', 'development'),
        appName: config.get('APP_NAME'),
        provider: config.get('LOG_PROVIDER'),  // 'default' or 'winston'
        level: config.get('LOG_LEVEL'),        // Optional override
        format: config.get('LOG_FORMAT'),      // Optional override
        enableFileLogger: config.get('LOG_TO_FILE') === 'true',
        enableHttpLogger: true,
        httpLogger: {
          enableRequestLog: true,
          enableResponseLog: true,
          slowRequestThreshold: 3000,
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

Inject and use the `LoggerService`:

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from '@vritti/api-sdk';

@Injectable()
export class UsersService {
  constructor(private readonly logger: LoggerService) {}

  async createUser(data: CreateUserDto) {
    this.logger.log('Creating new user', 'UsersService');

    try {
      const user = await this.userRepository.create(data);
      this.logger.log('User created successfully', { userId: user.id });
      return user;
    } catch (error) {
      this.logger.error('Failed to create user', error.stack, 'UsersService');
      throw error;
    }
  }
}
```

### Environment Presets

The logger module provides pre-configured settings based on environment:

| Environment | Provider | Level | Format | File Logging | HTTP Logging |
|------------|----------|-------|--------|--------------|--------------|
| development | winston | debug | text | No | Yes (verbose) |
| staging | winston | log | json | Yes | Yes |
| production | winston | warn | json | Yes | Limited |
| test | winston | error | json | No | No |

### Provider Selection

Choose between NestJS default Logger or Winston:

```typescript
// Use NestJS default Logger
LoggerModule.forRoot({
  environment: 'development',
  provider: 'default',  // Simple, built-in NestJS logger
})

// Use Winston (default)
LoggerModule.forRoot({
  environment: 'production',
  provider: 'winston',  // Advanced features, file logging, etc.
})
```

**Environment Variable:**
```bash
# In .env file
LOG_PROVIDER=default  # or 'winston'
```

**Important:** When using `LOG_PROVIDER=default`, update your `main.ts` to avoid circular references:

```typescript
async function bootstrap() {
  const logProvider = process.env.LOG_PROVIDER || 'winston';
  const useBuiltInLogger = logProvider === 'default';

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    useBuiltInLogger ? {} : {
      logger: new LoggerService({
        environment: process.env.NODE_ENV
      })
    },
  );

  // Only replace logger when using Winston
  if (!useBuiltInLogger) {
    const appLogger = app.get(LoggerService);
    app.useLogger(appLogger);
  }

  // ... rest of bootstrap
}
```

### HTTP Request Logging

HTTP logging is automatically enabled when `enableHttpLogger: true`. The interceptor is registered globally:

```typescript
LoggerModule.forRoot({
  environment: 'development',
  enableHttpLogger: true,
  httpLogger: {
    enableRequestLog: true,      // Log incoming requests
    enableResponseLog: true,     // Log outgoing responses
    slowRequestThreshold: 3000,  // Warn on requests > 3 seconds
  },
})
```

**Request Log Example:**
```
2025-01-23T10:30:45.123Z INFO   [abc123] [HTTP] → POST /api/users
```

**Response Log Example:**
```
2025-01-23T10:30:45.456Z INFO   [abc123] [HTTP] ← 201 POST /api/users (333ms)
```

**Slow Request Warning:**
```
2025-01-23T10:30:50.789Z WARN   [abc123] [HTTP] ← 200 GET /api/reports (4521ms) [SLOW]
```

### Correlation ID Middleware

Correlation IDs are automatically included in all logs when the middleware is registered:

```typescript
// In main.ts (Fastify)
const correlationMiddleware = app.get(CorrelationIdMiddleware);
const fastifyInstance = app.getHttpAdapter().getInstance();
fastifyInstance.addHook('onRequest', async (request, reply) => {
  await correlationMiddleware.onRequest(request as any, reply as any);
});
```

The correlation ID appears in all logs:
```
2025-01-23T10:30:45.123Z INFO   [abc123] [UsersService] Creating new user
```

### Custom Configuration

Override preset defaults for specific needs:

```typescript
LoggerModule.forRoot({
  environment: 'production',  // Start with production preset
  level: 'debug',             // Override: use debug level
  enableFileLogger: true,     // Enable file logging
  filePath: './logs',         // Custom log directory
  maxFiles: '30d',           // Keep logs for 30 days
  httpLogger: {
    enableRequestLog: true,   // Override: enable request logs in production
    enableResponseLog: true,
    slowRequestThreshold: 5000,  // 5 seconds
  },
})
```

### Logging with Metadata

Add custom metadata to enrich your logs (Winston only):

```typescript
this.logger.logWithMetadata(
  'log',
  'Payment processed',
  {
    orderId: order.id,
    amount: order.total,
    paymentMethod: 'credit_card',
  },
  'PaymentService'
);
```

### Child Loggers

Create context-specific loggers:

```typescript
@Injectable()
export class OrderService {
  private readonly logger: LoggerService;

  constructor(loggerService: LoggerService) {
    this.logger = loggerService.child('OrderService');
  }

  processOrder(orderId: string) {
    this.logger.log('Processing order', { orderId });
    // All logs from this logger will include context: "OrderService"
  }
}
```

### Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `environment` | `string` | Required | Environment preset: `development`, `staging`, `production`, `test` |
| `provider` | `'default' \| 'winston'` | `'winston'` | Logger implementation to use |
| `appName` | `string` | - | Application name (included in all logs) |
| `level` | `string` | Preset | Log level: `error`, `warn`, `log`, `debug`, `verbose` |
| `format` | `'text' \| 'json'` | Preset | Log output format |
| `enableFileLogger` | `boolean` | Preset | Enable file-based logging |
| `filePath` | `string` | `'./logs'` | Directory for log files |
| `maxFiles` | `string` | `'14d'` | Log retention period |
| `enableHttpLogger` | `boolean` | Preset | Enable HTTP request/response logging |
| `httpLogger.enableRequestLog` | `boolean` | Preset | Log incoming HTTP requests |
| `httpLogger.enableResponseLog` | `boolean` | Preset | Log outgoing HTTP responses |
| `httpLogger.slowRequestThreshold` | `number` | Preset | Threshold (ms) to warn on slow requests |

## API Reference

### Modules

#### `DatabaseModule`

- **`forServer(options)`**: Configure for Gateway/HTTP mode
- **`forMicroservice(options)`**: Configure for RabbitMQ/messaging mode

#### `AuthConfigModule`

- **`forRootAsync()`**: Register JWT authentication with global guard

### Services

#### `TenantDatabaseService`

Access tenant-specific database connections.

```typescript
class TenantDatabaseService {
  async getClient<T = any>(): Promise<T>
  clearConnection(tenantId: string): void
}
```

#### `PrimaryDatabaseService`

Access the primary/platform database (tenant registry). Use this for cloud-api operations like managing tenants, users, sessions, etc.

```typescript
class PrimaryDatabaseService {
  async getPrimaryDbClient<T = any>(): Promise<T>
  async getTenantInfo(identifier: string): Promise<TenantInfo | null>
}
```

**Example:**
```typescript
@Injectable()
export class TenantRepository {
  constructor(private readonly database: PrimaryDatabaseService) {}

  async findAll() {
    const prisma = await this.database.getPrimaryDbClient<PrismaClient>();
    return prisma.tenant.findMany();
  }
}
```

#### `TenantContextService`

Manage request-scoped tenant context.

```typescript
class TenantContextService {
  getTenant(): TenantInfo
  setTenant(tenant: TenantInfo): void
  hasTenant(): boolean
  clearTenant(): void
}
```

### Decorators

#### `@Public()`

Bypass authentication on specific endpoints.

#### `@Onboarding()`

Accept only onboarding tokens (for registration/verification flows).

#### `@Tenant()`

Inject tenant metadata into controller methods.

### Interfaces

#### `TenantInfo`

```typescript
interface TenantInfo {
  id: string;
  subdomain: string;
  type: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  databaseHost: string;
  databasePort?: number;
  databaseName: string;
  databaseUsername: string;
  databasePassword: string;
  databaseSchema?: string;
  sslMode?: 'require' | 'prefer' | 'disable';
}
```

#### `DatabaseModuleOptions`

```typescript
interface DatabaseModuleOptions {
  // Gateway mode only
  primaryDb?: {
    host: string;
    port?: number;
    username: string;
    password: string;
    database: string;
    schema?: string;
    sslMode?: 'require' | 'prefer' | 'disable';
  };

  // Required for both modes
  prismaClientConstructor: any;

  // Optional
  connectionCacheTTL?: number;  // Default: 300000 (5 minutes)
  maxConnections?: number;      // Default: 10
}
```

## Development

### Prerequisites

- Node.js 18+
- Yarn
- PostgreSQL (for testing)

### Setup

```bash
git clone https://github.com/vritti-ai-platforms/api-sdk.git
cd api-sdk
yarn install
```

### Available Scripts

- `yarn dev` - Run in watch mode
- `yarn build` - Build for production
- `yarn type-check` - TypeScript type checking
- `yarn test` - Run tests
- `yarn test:watch` - Run tests in watch mode
- `yarn lint` - Lint source files
- `yarn format` - Format code with Prettier
- `yarn clean` - Remove build artifacts

### Project Structure

```
api-sdk/
├── src/
│   ├── auth/                    # Authentication module
│   │   ├── guards/              # VrittiAuthGuard
│   │   ├── decorators/          # @Public, @Onboarding
│   │   └── auth-config.module.ts
│   ├── database/                # Database module
│   │   ├── services/            # Database services
│   │   ├── interceptors/        # Tenant context interceptors
│   │   ├── decorators/          # @Tenant
│   │   ├── interfaces/          # TypeScript interfaces
│   │   └── database.module.ts
│   ├── request/                 # Request utilities (internal)
│   └── index.ts                 # Public API exports
├── dist/                        # Build output
└── package.json
```

## Best Practices

### 1. Environment Variables

Always use `ConfigService` and validate environment variables at startup:

```typescript
import { plainToClass } from 'class-transformer';
import { IsString, IsNumber, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  JWT_SECRET: string;

  @IsString()
  PRIMARY_DB_HOST: string;

  @IsNumber()
  PRIMARY_DB_PORT: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
```

### 2. Database Connections

Let the SDK manage connection pooling. Don't create custom Prisma instances:

```typescript
// ✅ Good
@Injectable()
export class UsersService {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  async findAll() {
    const db = await this.tenantDb.getClient();
    return db.user.findMany();
  }
}

// ❌ Bad - Don't do this
@Injectable()
export class UsersService {
  private prisma = new PrismaClient();  // ❌ Breaks multi-tenancy
}
```

### 3. Tenant Context

Always use `@Tenant()` decorator instead of manually accessing `TenantContextService`:

```typescript
// ✅ Good
@Get('info')
async getInfo(@Tenant() tenant: TenantInfo) {
  return { subdomain: tenant.subdomain };
}

// ❌ Bad - Avoid manual service injection
@Get('info')
async getInfo() {
  const tenant = this.tenantContext.getTenant();  // ❌ Unnecessary
}
```

## Troubleshooting

### Issue: "TenantContextService not found"

**Cause:** DatabaseModule not imported or registered incorrectly.

**Solution:** Ensure `DatabaseModule.forServer()` or `forMicroservice()` is imported in your module.

### Issue: "JWT secret not configured"

**Cause:** Missing `JWT_SECRET` environment variable.

**Solution:** Add `JWT_SECRET` to your `.env` file.

### Issue: "Tenant identifier not found"

**Cause:** Request missing subdomain and `x-tenant-id` header.

**Solution:** Ensure requests include tenant identifier:
- Use subdomain: `https://acme.api.vritti.com`
- Or add header: `x-tenant-id: acme`

### Issue: "Connection pool exhausted"

**Cause:** Too many concurrent tenants or connections not released.

**Solution:** Increase `maxConnections` in DatabaseModule options:

```typescript
DatabaseModule.forServer({
  useFactory: () => ({
    // ...
    maxConnections: 20,  // Increase from default 10
  }),
})
```

## Migration Guide

### From Manual Setup to SDK

If you're migrating from a manual setup:

1. Remove manual interceptor registrations
2. Remove manual guard registrations
3. Replace custom tenant context with `@Tenant()` decorator
4. Update imports to use SDK exports

**Before:**
```typescript
@Module({
  imports: [RequestModule],
  providers: [
    { provide: APP_GUARD, useClass: VrittiAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
})
```

**After:**
```typescript
@Module({
  imports: [
    DatabaseModule.forServer({ /* config */ }),
    AuthConfigModule.forRootAsync(),
  ],
})
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests and linting: `yarn test && yarn lint`
5. Commit your changes: `git commit -am 'Add new feature'`
6. Push to the branch: `git push origin feature/my-feature`
7. Submit a pull request

## License

MIT © [Shashank Raju](https://github.com/vritti-ai-platforms)

## Author

**Shashank Raju**
- Email: shashank@vrittiai.com
- GitHub: [@vritti-ai-platforms](https://github.com/vritti-ai-platforms)
