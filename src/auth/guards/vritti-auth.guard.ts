import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { FastifyRequest } from 'fastify';
import { PrimaryDatabaseService } from '../../database/services/primary-database.service';
import { RequestService } from '../../request/services/request.service';
import { getConfig } from '../../config';
import { verifyTokenHash } from '../utils/token-hash.util';

// Type for decoded JWT token
interface DecodedToken {
  userId?: string;
  type?: string;
  refreshTokenHash?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  [key: string]: unknown;
}

/**
 * Vritti Authentication Guard - Validates JWT access tokens and tenant context
 *
 * This guard performs access token validation and attaches user data to request.
 * NOTE: Refresh tokens are NOT validated here - they are only validated in
 * /auth/token and /auth/refresh endpoints (session.service.ts).
 *
 * Validation Flow:
 * 1. Checks if endpoint is marked with @Public() decorator → skip all validation
 * 2. Checks if endpoint is marked with @Onboarding() decorator:
 *    - Requires token type='onboarding'
 *    - Validates JWT signature and expiry only
 *    - Skips tenant validation
 *    - Attaches user data to request.user
 * 3. For regular endpoints (no decorator):
 *    - Rejects tokens with type='onboarding'
 *    - Validates access token (JWT signature, expiry, nbf)
 *    - Validates tenant exists and is ACTIVE
 *    - Attaches user data to request.user
 *
 * Token Format:
 * - Access Token: "Authorization: Bearer <jwt_token>"
 *
 * Token Types:
 * - type='onboarding': Limited access during registration flow (@Onboarding endpoints only)
 * - type='access': Full access to authenticated endpoints
 *
 * Environment Variables Required:
 * - JWT_SECRET: Secret key to verify access tokens (required)
 *
 * Error Responses:
 * - 401: Invalid/expired access token
 * - 401: Tenant not found or inactive
 * - 401: Tenant identifier not found
 * - 401: Token type mismatch (onboarding token on regular endpoint or vice versa)
 *
 * @example
 * // Automatically registered by AuthConfigModule.forRootAsync()
 * // No manual registration needed
 * //
 * // Internal registration uses useExisting pattern:
 * // providers: [
 * //   VrittiAuthGuard,
 * //   {
 * //     provide: APP_GUARD,
 * //     useExisting: VrittiAuthGuard,
 * //   },
 * // ]
 *
 * @example
 * // Bypass guard with @Public() decorator
 * @Public()
 * @Post('auth/login')
 * async login(@Body() dto: LoginDto) { ... }
 *
 * @example
 * // Restrict to onboarding tokens with @Onboarding() decorator
 * @Onboarding()
 * @Post('onboarding/verify-email')
 * async verifyEmail(@Request() req) {
 *   const userId = req.user.id; // Available from guard
 *   ...
 * }
 */
@Injectable({ scope: Scope.REQUEST })
export class VrittiAuthGuard implements CanActivate {
  private readonly logger = new Logger(VrittiAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly primaryDatabase: PrimaryDatabaseService,
    private readonly requestService: RequestService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // Step 1: Check if endpoint is marked as @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.debug('Public endpoint detected, skipping authentication');
      return true;
    }

    // Step 2: Check if endpoint is marked as @Onboarding()
    const isOnboarding = this.reflector.getAllAndOverride<boolean>('isOnboarding', [
      context.getHandler(),
      context.getClass(),
    ]);

    try {
      // Extract and validate access token
      const accessToken = this.requestService.getAccessToken();
      if (!accessToken) {
        this.logger.warn('Access token not found in Authorization header');
        throw new UnauthorizedException('Access token not found');
      }

      // Decode token to check type (without full validation yet)
      const decodedToken = this.jwtService.decode(accessToken) as DecodedToken;
      if (!decodedToken) {
        this.logger.warn('Failed to decode access token');
        throw new UnauthorizedException('Invalid token format');
      }

      // Step 3: Handle @Onboarding endpoints
      if (isOnboarding) {
        // Only accept onboarding tokens
        if (decodedToken.type !== 'onboarding') {
          this.logger.warn('Onboarding endpoint requires onboarding token');
          throw new UnauthorizedException('This endpoint requires an onboarding token');
        }

        // Validate JWT signature and expiry only
        const validatedToken = this.validateAccessToken(accessToken);
        this.logger.debug('Onboarding token validated successfully');

        // Validate refresh token binding if enabled
        this.validateRefreshTokenBinding(context, validatedToken);

        // Attach user data to request (use userId field from our tokens, fallback to sub for standard JWT)
        const userId = (validatedToken as any).userId;
        (request as any).user = { id: userId };

        return true;
      }

      // Step 4: Handle regular endpoints - reject onboarding tokens
      if (decodedToken.type === 'onboarding') {
        this.logger.warn('Regular endpoint accessed with onboarding token');
        throw new UnauthorizedException('Onboarding tokens cannot access this endpoint');
      }

      // Step 5: Validate access token
      const validatedToken = this.validateAccessToken(accessToken);
      this.logger.debug('Access token validated successfully');

      // Step 5.5: Validate refresh token binding if enabled
      this.validateRefreshTokenBinding(context, validatedToken);

      // Step 6: Attach user data to request (use userId field from our tokens)
      const userId = (validatedToken as any).userId;
      (request as any).user = { id: userId };

      // Step 7: Extract tenant identifier using RequestService
      const tenantIdentifier = this.requestService.getTenantIdentifier();

      if (!tenantIdentifier) {
        this.logger.warn('Tenant identifier not found in request');
        throw new UnauthorizedException('Tenant identifier not found');
      }

      this.logger.debug(`Tenant identifier extracted: ${tenantIdentifier}`);

      // Step 8: Skip database validation for platform admin (cloud.vritti.com)
      if (tenantIdentifier === 'cloud') {
        this.logger.debug('Platform admin access detected, skipping tenant database validation');
        return true;
      }

      // Step 9: Fetch tenant details from primary database
      const tenantInfo = await this.primaryDatabase.getTenantInfo(tenantIdentifier);

      if (!tenantInfo) {
        this.logger.warn(`Invalid tenant: ${tenantIdentifier}`);
        throw new UnauthorizedException('Invalid tenant');
      }

      // Step 10: Validate tenant is ACTIVE
      if (tenantInfo.status !== 'ACTIVE') {
        this.logger.warn(`Tenant ${tenantIdentifier} has status: ${tenantInfo.status}`);
        throw new UnauthorizedException(`Tenant is ${tenantInfo.status}`);
      }

      this.logger.debug(`Tenant validated: ${tenantInfo.subdomain} (${tenantInfo.type})`);

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Unexpected error in auth guard', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Validate access token with proper expiry checks
   * Throws UnauthorizedException if token is invalid or expired
   */
  private validateAccessToken(token: string): DecodedToken {
    try {
      const decoded = this.jwtService.verify<DecodedToken>(token);

      this.logger.debug(`Access token decoded for user: ${(decoded as any).userId}`);

      // Check expiry explicitly (JwtService already validates, but we log it)
      if (decoded.exp) {
        const expiryTime = decoded.exp * 1000; // Convert to milliseconds
        const currentTime = Date.now();

        const timeRemaining = expiryTime - currentTime;
        this.logger.debug(
          `Access token valid for ${Math.floor(timeRemaining / 1000)} more seconds`,
        );
      }

      return decoded;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      const jwtError = error as { name?: string; message?: string; expiredAt?: string };
      if (jwtError?.name === 'TokenExpiredError') {
        this.logger.warn(`Access token expired at: ${jwtError?.expiredAt}`);
        throw new UnauthorizedException('Access token has expired');
      }

      if (jwtError?.name === 'JsonWebTokenError') {
        this.logger.warn(`Access token verification failed: ${jwtError?.message}`);
        throw new UnauthorizedException('Invalid access token');
      }

      if (jwtError?.name === 'NotBeforeError') {
        this.logger.warn('Access token used before valid (nbf claim)');
        throw new UnauthorizedException('Access token not yet valid');
      }

      this.logger.error('Unexpected error validating access token', error);
      throw new UnauthorizedException('Access token validation failed');
    }
  }

  /**
   * Validate that the access token is bound to the refresh token in the cookie.
   * This prevents token theft - a stolen access token is useless without the
   * corresponding refresh token cookie.
   *
   * @param context - The execution context containing the request
   * @param validatedToken - The decoded and validated JWT token
   * @throws UnauthorizedException if token binding validation fails
   */
  private validateRefreshTokenBinding(
    context: ExecutionContext,
    validatedToken: DecodedToken,
  ): void {
    const config = getConfig();

    // Skip validation if disabled in config
    if (!config.jwt.validateTokenBinding) {
      this.logger.debug('Token binding validation is disabled');
      return;
    }

    // Skip validation if token doesn't have refreshTokenHash
    // (backwards compatibility for tokens issued before this feature)
    if (!validatedToken.refreshTokenHash) {
      this.logger.debug('Token does not contain refreshTokenHash, skipping binding validation');
      return;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const cookies = (request as any).cookies || {};
    const refreshToken = cookies[config.cookie.refreshCookieName];

    if (!refreshToken) {
      this.logger.warn('Session validation failed - refresh token cookie not found');
      throw new UnauthorizedException('Session validation failed');
    }

    if (!verifyTokenHash(refreshToken, validatedToken.refreshTokenHash)) {
      this.logger.warn('Session validation failed - token binding mismatch');
      throw new UnauthorizedException('Session validation failed');
    }

    this.logger.debug('Token binding validated successfully');
  }

}
