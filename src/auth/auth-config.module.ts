import { type DynamicModule, Global, type InjectionToken, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { RequestModule } from '../request/request.module';
import {
  AUTH_CONFIG,
  AUTH_CONFIG_DEFAULTS,
  type AuthConfig,
  type CookieConfig,
  type GuardConfig,
  type TokenExpiry,
} from './auth.config';
import { VrittiAuthGuard } from './guards/vritti-auth.guard';
import { TokenService } from './services/token.service';

// Factory return type — tokenExpiry is required, cookie and guard are partial with defaults merged
interface AuthConfigInput {
  tokenExpiry: TokenExpiry;
  cookie?: Partial<CookieConfig>;
  guard?: Partial<GuardConfig>;
}

interface AuthConfigModuleOptions<T extends unknown[] = unknown[]> {
  useFactory: (...args: [...T]) => AuthConfigInput | Promise<AuthConfigInput>;
  inject?: InjectionToken[];
}

// Merges user-provided partial config with defaults to produce a complete AuthConfig
function mergeWithDefaults(input: AuthConfigInput): AuthConfig {
  return {
    tokenExpiry: input.tokenExpiry,
    cookie: {
      ...AUTH_CONFIG_DEFAULTS.cookie,
      ...(input.cookie ?? {}),
    },
    guard: {
      ...AUTH_CONFIG_DEFAULTS.guard,
      ...(input.guard ?? {}),
    },
  };
}

@Global()
@Module({})
export class AuthConfigModule {
  // Registers JWT, TokenService, and global VrittiAuthGuard
  static forRootAsync<T extends unknown[] = unknown[]>(options: AuthConfigModuleOptions<T>): DynamicModule {
    return {
      module: AuthConfigModule,
      imports: [
        ConfigModule,
        RequestModule,
        JwtModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            secret: config.getOrThrow<string>('JWT_SECRET'),
            signOptions: { algorithm: 'HS256' as const },
          }),
        }),
      ],
      providers: [
        {
          provide: Reflector,
          useClass: Reflector,
        },
        {
          provide: APP_GUARD,
          useClass: VrittiAuthGuard,
        },
        {
          provide: AUTH_CONFIG,
          useFactory: async (...args: unknown[]) => {
            const input = await options.useFactory(...(args as [...T]));
            return mergeWithDefaults(input);
          },
          inject: options.inject || [],
        },
        TokenService,
      ],
      exports: [JwtModule, TokenService, AUTH_CONFIG],
    };
  }
}
