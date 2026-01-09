import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * CSRF Guard
 *
 * Global guard that automatically protects all state-changing requests (POST, PUT, PATCH, DELETE)
 * from CSRF attacks using Fastify's csrf-protection plugin.
 *
 * Flow:
 * 1. Skip safe methods (GET, HEAD, OPTIONS)
 * 2. Skip endpoints marked with @Public()
 * 3. Validate CSRF token for all other requests
 *
 * Token Sources (in priority order by @fastify/csrf-protection):
 * 1. req.headers['csrf-token']
 * 2. req.headers['xsrf-token']
 * 3. req.headers['x-csrf-token']
 * 4. req.headers['x-xsrf-token']
 * 5. req.body._csrf
 *
 * This guard should be registered globally in main.ts after CSRF plugin registration.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(request.method)) {
      return true;
    }

    // Validate CSRF token using Fastify's csrfProtection hook
    try {
      // Access the Fastify instance's CSRF protection
      const fastifyInstance = request.server as any;

      if (!fastifyInstance.csrfProtection) {
        this.logger.error('CSRF protection plugin not found. Ensure @fastify/csrf-protection is registered.');
        throw new ForbiddenException('CSRF protection not configured');
      }

      // Call the CSRF protection hook
      // This validates the token from headers or body against the signed cookie
      await new Promise<void>((resolve, reject) => {
        fastifyInstance.csrfProtection(request, reply, (err?: Error) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      this.logger.debug(`CSRF validation successful for ${request.method} ${request.url}`);

      return true;
    } catch (error) {
      this.logger.warn(
        `CSRF validation failed for ${request.method} ${request.url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      throw new ForbiddenException({
        errors: [
          {
            field: 'csrf',
            message: 'Invalid or missing CSRF token',
          },
        ],
        message: 'CSRF validation failed',
      });
    }
  }
}
