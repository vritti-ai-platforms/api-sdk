import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { TenantInfo } from '../interfaces';
import { TenantContextService } from '../services/tenant-context.service';

/**
 * Parameter decorator that injects tenant metadata into controller method
 *
 * This decorator retrieves tenant information (ID, slug, type, etc.)
 * from the REQUEST-SCOPED TenantContextService.
 *
 * Useful for:
 * - Logging tenant-specific information
 * - Implementing tenant-specific business logic
 * - Auditing and tracking
 * - Conditional feature flags
 *
 * @returns TenantInfo object with tenant metadata
 *
 * @example
 * // Access tenant metadata
 * @Get('info')
 * async getTenantInfo(@Tenant() tenant: TenantInfo) {
 *   return {
 *     id: tenant.id,
 *     subdomain: tenant.subdomain,
 *     type: tenant.type,
 *   };
 * }
 *
 * @example
 * // Use for logging
 * @Post()
 * async createUser(
 *   @Body() dto: CreateUserDto,
 *   @Tenant() tenant: TenantInfo,
 * ) {
 *   this.logger.log(`Creating user for tenant: ${tenant.subdomain}`);
 *   // ...
 * }
 *
 * @example
 * // Conditional business logic
 * @Get('features')
 * async getFeatures(@Tenant() tenant: TenantInfo) {
 *   if (tenant.type === 'ENTERPRISE') {
 *     return ['feature-a', 'feature-b', 'feature-c'];
 *   }
 *   return ['feature-a'];
 * }
 */
export const Tenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): TenantInfo => {
  const request = ctx.switchToHttp().getRequest();

  // Get from TenantContextService
  const tenantContext = request.app?.get?.(TenantContextService);

  if (!tenantContext) {
    throw new Error('TenantContextService not found.');
  }

  return tenantContext.getTenant();
});
