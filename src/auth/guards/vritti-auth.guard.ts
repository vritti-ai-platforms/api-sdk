import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { PrimaryDatabaseService } from '../../database/services/primary-database.service';
import { RequestService } from '../../request/services/request.service';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';
import { verifyTokenHash } from '../utils/token-hash.util';

interface DecodedToken {
  userId: string;
  sessionId: string;
  sessionType: string;
  tokenType: string;
  refreshTokenHash?: string;
  exp?: number;
  iat?: number;
}

@Injectable({ scope: Scope.REQUEST })
export class VrittiAuthGuard implements CanActivate {
  private readonly logger = new Logger(VrittiAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    readonly _configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly primaryDatabase: PrimaryDatabaseService,
    private readonly requestService: RequestService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    // Validate CSRF for state-changing methods (unless @SkipCsrf)
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!skipCsrf) {
      await this.validateCsrf(request, reply);
    }

    // @Public() endpoints skip all auth
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [context.getHandler(), context.getClass()]);
    if (isPublic) {
      return true;
    }

    // @Onboarding() endpoints require ONBOARDING session type
    const isOnboarding = this.reflector.getAllAndOverride<boolean>('isOnboarding', [
      context.getHandler(),
      context.getClass(),
    ]);

    try {
      const accessToken = this.requestService.getAccessToken();
      if (!accessToken) {
        throw new UnauthorizedException('Access token not found');
      }

      // Validate JWT signature and expiry
      const decodedAccessToken = this.validateAccessToken(accessToken);

      // Must be an ACCESS token, not REFRESH
      if (decodedAccessToken.tokenType !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Validate refresh token binding (hash check on every request)
      this.validateRefreshTokenBinding(decodedAccessToken);

      // @Onboarding endpoints require ONBOARDING session type
      if (isOnboarding && decodedAccessToken.sessionType !== 'ONBOARDING') {
        throw new UnauthorizedException('This endpoint requires an onboarding session');
      }

      // Regular endpoints reject ONBOARDING sessions
      if (!isOnboarding && decodedAccessToken.sessionType === 'ONBOARDING') {
        throw new UnauthorizedException('Onboarding sessions cannot access this endpoint');
      }

      // Attach session info to request
      (request as any).sessionInfo = {
        userId: decodedAccessToken.userId,
        sessionId: decodedAccessToken.sessionId,
        sessionType: decodedAccessToken.sessionType,
      };

      // Skip tenant validation for @Onboarding endpoints
      if (isOnboarding) {
        return true;
      }

      // Extract and validate tenant
      const tenantIdentifier = this.requestService.getTenantIdentifier();
      if (!tenantIdentifier) {
        throw new UnauthorizedException('Tenant identifier not found');
      }

      // TODO: Re-enable once tenant-specific login is implemented
      // Skip DB validation for platform admin
      // if (tenantIdentifier === 'cloud') {
      //   return true;
      // }

      // Validate tenant exists and is active
      const tenantInfo = await this.primaryDatabase.getTenantInfo(tenantIdentifier);
      if (!tenantInfo) {
        throw new UnauthorizedException('Invalid tenant');
      }
      if (tenantInfo.status !== 'ACTIVE') {
        throw new UnauthorizedException(`Tenant is ${tenantInfo.status}`);
      }

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Unexpected error in auth guard', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  // Validates JWT signature, expiry, and not-before claims
  private validateAccessToken(token: string): DecodedToken {
    try {
      return this.jwtService.verify<DecodedToken>(token);
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;

      const jwtError = error as { name?: string; message?: string };
      if (jwtError?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Access token has expired');
      }
      if (jwtError?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid access token');
      }
      if (jwtError?.name === 'NotBeforeError') {
        throw new UnauthorizedException('Access token not yet valid');
      }

      throw new UnauthorizedException('Access token validation failed');
    }
  }

  // Validates that the access token is bound to the refresh token in the cookie
  private validateRefreshTokenBinding(decodedAccessToken: DecodedToken): void {
    if (!decodedAccessToken.refreshTokenHash) {
      throw new UnauthorizedException('Token missing refresh token binding');
    }

    const refreshToken = this.requestService.getRefreshToken();

    if (!refreshToken) {
      throw new UnauthorizedException('Session validation failed');
    }

    if (!verifyTokenHash(refreshToken, decodedAccessToken.refreshTokenHash)) {
      throw new UnauthorizedException('Session validation failed');
    }
  }

  // Validates CSRF token for state-changing requests
  private async validateCsrf(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(request.method)) return;

    try {
      const fastifyInstance = request.server as any;
      if (!fastifyInstance.csrfProtection) {
        throw new ForbiddenException('CSRF protection not configured');
      }

      await new Promise<void>((resolve, reject) => {
        fastifyInstance.csrfProtection(request, reply, (err?: Error) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      throw new ForbiddenException({
        errors: [{ field: 'csrf', message: 'Invalid or missing CSRF token' }],
        message: 'CSRF validation failed',
      });
    }
  }
}
