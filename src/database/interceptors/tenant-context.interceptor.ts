import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { Observable } from 'rxjs';
import { RequestService } from '../../request';
import { PrimaryDatabaseService } from '../services/primary-database.service';
import { TenantContextService } from '../services/tenant-context.service';

/**
 * Interceptor that extracts tenant context from HTTP requests (Gateway Mode)
 *
 * This interceptor runs BEFORE the controller and:
 * 1. Checks if endpoint is marked with @Public() decorator
 * 2. Extracts tenant identifier from request using RequestService
 * 3. For public endpoints without tenant info → skip tenant context setup
 * 4. For all other requests → queries primary database for tenant configuration
 * 5. Stores tenant info in REQUEST-SCOPED TenantContextService
 *
 * Tenant resolution order:
 * - First: x-tenant-id header
 * - Fallback: x-subdomain header
 *
 * Public Endpoints:
 * - Endpoints marked with @Public() decorator can work with OR without tenant context
 * - If no tenant info in headers → skip tenant context setup (useful for OAuth, registration)
 * - If tenant info present in headers → setup tenant context (multi-tenant public APIs)
 *
 * Only used in API Gateway. Microservices use MessageTenantContextInterceptor instead.
 *
 * @example
 * // Public endpoint without tenant (OAuth callback, registration)
 * @Public()
 * @Get('onboarding/oauth/google')
 * async oauthGoogle() { ... }
 * // No x-tenant-id header → skips tenant context
 *
 * @example
 * // Public endpoint with tenant (multi-tenant public API)
 * @Public()
 * @Get('public/data')
 * async getPublicData() { ... }
 * // x-tenant-id: acme → sets tenant context for 'acme'
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantContextInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    private readonly primaryDatabase: PrimaryDatabaseService,
    private readonly requestService: RequestService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    this.logger.debug(`Processing request: ${request.method} ${request.url}`);

    // Check if endpoint is marked as @Public() or @Onboarding()
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [context.getHandler(), context.getClass()]);
    const isOnboarding = this.reflector.getAllAndOverride<boolean>('isOnboarding', [context.getHandler(), context.getClass()]);

    try {
      // Extract tenant identifier using RequestService (no code duplication)
      const tenantIdentifier = this.requestService.getTenantIdentifier();

      // Skip tenant context for public or onboarding endpoints without tenant info
      if ((isPublic || isOnboarding) && !tenantIdentifier) {
        this.logger.debug('Public/onboarding endpoint without tenant identifier, skipping tenant context setup');
        return next.handle();
      }

      if (!tenantIdentifier) {
        throw new UnauthorizedException('Tenant identifier not found in request');
      }

      this.logger.debug(`Tenant identifier extracted: ${tenantIdentifier}`);

      // Special case: cloud.vritti.com (platform admin)
      if (tenantIdentifier === 'cloud') {
        this.logger.log('Cloud platform access detected, skipping tenant context setup');
        return next.handle();
      }

      // Query primary database for tenant configuration
      const tenantInfo = await this.primaryDatabase.getTenantInfo(tenantIdentifier);

      if (!tenantInfo) {
        this.logger.warn(`Invalid tenant: ${tenantIdentifier}`);
        throw new UnauthorizedException('Invalid tenant');
      }

      if (tenantInfo.status !== 'ACTIVE') {
        this.logger.warn(`Tenant ${tenantIdentifier} has status: ${tenantInfo.status}`);
        throw new UnauthorizedException(`Tenant is ${tenantInfo.status}`);
      }

      this.logger.debug(`Tenant config loaded: ${tenantInfo.subdomain} (${tenantInfo.type})`);

      // Store in REQUEST-SCOPED context
      this.tenantContext.setTenant(tenantInfo);

      // Also attach to request object for easy access
      (request as any).tenant = tenantInfo;

      this.logger.log(`Tenant context set: ${tenantInfo.subdomain}`);
    } catch (error) {
      this.logger.error('Failed to set tenant context', error);
      throw error;
    }

    return next.handle();
  }
}
