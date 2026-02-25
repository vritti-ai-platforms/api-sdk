import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { RequestModule } from '../request/request.module';
import { VrittiAuthGuard } from './guards/vritti-auth.guard';
import { JwtAuthService } from './services/jwt-auth.service';

@Global()
@Module({})
export class AuthConfigModule {
  // Registers JWT and global VrittiAuthGuard with async config
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
        JwtAuthService,
      ],
      exports: [
        JwtModule, // Export for use in other modules (e.g., generating tokens)
        JwtAuthService,
      ],
    };
  }
}
