import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Allowed origins for SSE CORS
 * These must match the frontend origins
 */
const SSE_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3001',
  'http://localhost:3012',
  'http://localhost:5174',
  'http://local.vrittiai.com:3012',
  'http://cloud.local.vrittiai.com:3012',
  'https://local.vrittiai.com:3012',
  'https://cloud.local.vrittiai.com:3012',
];

// Type for decoded JWT token
interface DecodedToken {
  userId?: string;
  type?: string;
  exp?: number;
  [key: string]: unknown;
}

/**
 * SSE Authentication Guard - For Server-Sent Events endpoints
 *
 * This guard is specifically designed for SSE endpoints where:
 * 1. Browser's EventSource API cannot send custom headers
 * 2. Token must be passed via query parameter
 * 3. CORS headers must be set before any response (including errors)
 *
 * Validation Flow:
 * 1. Set CORS headers FIRST (ensures error responses include CORS)
 * 2. Extract token from query param (?token=<jwt>)
 * 3. Validate token is type='onboarding'
 * 4. Attach user data to request.user
 *
 * Usage:
 * ```typescript
 * @Sse('events')
 * @Public() // Bypass global VrittiAuthGuard
 * @UseGuards(SseAuthGuard)
 * async subscribeToEvents(@UserId() userId: string) { ... }
 * ```
 *
 * Note: Must be used with @Public() to bypass the global VrittiAuthGuard
 * since EventSource cannot send Authorization headers.
 */
@Injectable({ scope: Scope.REQUEST })
export class SseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SseAuthGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();

    // Step 1: Set CORS headers FIRST (before any validation that might throw)
    // This ensures error responses also have CORS headers
    this.setCorsHeaders(request, response);

    // Step 2: Extract token from query param
    const token = (request.query as Record<string, string>)?.token;

    if (!token) {
      this.logger.warn('SSE authentication failed: token not found in query params');
      throw new UnauthorizedException('Authentication required');
    }

    try {
      // Step 3: Decode and validate token
      const decodedToken = this.jwtService.decode(token) as DecodedToken;

      if (!decodedToken) {
        this.logger.warn('SSE authentication failed: invalid token format');
        throw new UnauthorizedException('Invalid token format');
      }

      // Step 4: Validate token type is 'onboarding'
      if (decodedToken.type !== 'onboarding') {
        this.logger.warn('SSE authentication failed: endpoint requires onboarding token');
        throw new UnauthorizedException('This endpoint requires an onboarding token');
      }

      // Step 5: Verify token signature and expiry
      const validatedToken = this.jwtService.verify<DecodedToken>(token);
      this.logger.debug(`SSE token validated for user: ${validatedToken.userId}`);

      // Step 6: Attach user data to request
      (request as any).user = { id: validatedToken.userId };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      const jwtError = error as { name?: string; message?: string };
      if (jwtError?.name === 'TokenExpiredError') {
        this.logger.warn('SSE authentication failed: token expired');
        throw new UnauthorizedException('Token has expired');
      }

      if (jwtError?.name === 'JsonWebTokenError') {
        this.logger.warn(`SSE authentication failed: ${jwtError?.message}`);
        throw new UnauthorizedException('Invalid token');
      }

      this.logger.error('Unexpected error in SSE auth guard', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Set CORS headers for SSE responses
   * Must be called before any potential exceptions
   */
  private setCorsHeaders(request: FastifyRequest, response: FastifyReply): void {
    const origin = request.headers.origin;

    if (origin && SSE_ALLOWED_ORIGINS.includes(origin)) {
      response.header('Access-Control-Allow-Origin', origin);
      response.header('Access-Control-Allow-Credentials', 'true');
      this.logger.debug(`CORS headers set for origin: ${origin}`);
    } else if (origin) {
      this.logger.warn(`SSE request from unauthorized origin: ${origin}`);
    }
  }
}
