import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { RequestModule } from '../request/request.module';
import { VrittiAuthGuard } from './guards/vritti-auth.guard';

/**
 * Global authentication configuration module
 *
 * This module provides:
 * - JWT token verification (JwtModule)
 * - Global authentication guard (VrittiAuthGuard)
 * - Support for @Public and @Onboarding decorators
 *
 * ## Features:
 * - Automatically applies VrittiAuthGuard to all routes
 * - Configures JwtModule with JWT_SECRET from environment
 * - Exports JwtModule for token generation in services
 *
 * ## Usage in Application:
 *
 * @example
 * // In app.module.ts
 * @Module({
 *   imports: [
 *     ConfigModule.forRoot({ isGlobal: true }),
 *
 *     // Auth configuration (global guard + JWT)
 *     AuthConfigModule.forRootAsync(),
 *
 *     // Database configuration (Gateway mode)
 *     DatabaseModule.forServer({
 *       useFactory: (config: ConfigService) => ({
 *         primaryDb: {
 *           host: config.get('PRIMARY_DB_HOST'),
 *           // ... other config
 *         },
 *         prismaClientConstructor: PrismaClient,
 *       }),
 *       inject: [ConfigService],
 *     }),
 *   ],
 * })
 * export class AppModule {}
 *
 * ## Environment Variables Required:
 * - JWT_SECRET: Secret key to verify access tokens (required)
 * - JWT_REFRESH_SECRET: Secret key for refresh tokens (optional, falls back to JWT_SECRET)
 *
 * ## Bypass Authentication:
 *
 * @example
 * // Skip authentication on specific endpoints
 * @Public()
 * @Post('auth/login')
 * async login() { ... }
 *
 * @example
 * // Onboarding endpoints (only accept onboarding tokens)
 * @Onboarding()
 * @Post('onboarding/verify-email')
 * async verifyEmail(@Request() req) {
 *   const userId = req.user.id; // Available from guard
 *   ...
 * }
 */
@Global()
@Module({})
export class AuthConfigModule {
  /**
   * Register the auth module with async configuration
   *
   * This method:
   * 1. Configures JwtModule with JWT_SECRET from ConfigService
   * 2. Provides VrittiAuthGuard globally (applies to all routes)
   * 3. Exports JwtModule for use in other modules (e.g., for signing tokens)
   *
   * @returns Dynamic module configuration
   */
  static forRootAsync(): DynamicModule {
    return {
      module: AuthConfigModule,
      imports: [
        ConfigModule,
        RequestModule,
        JwtModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            secret: config.get<string>('JWT_SECRET'),
            signOptions: {
              algorithm: 'HS256',
            },
          }),
        }),
      ],
      providers: [
        // Required for external packages - NestJS global Reflector not available
        {
          provide: Reflector,
          useClass: Reflector,
        },
        {
          provide: APP_GUARD,
          useClass: VrittiAuthGuard,
        },
      ],
      exports: [
        JwtModule, // Export for use in other modules (e.g., generating tokens)
      ],
    };
  }
}
