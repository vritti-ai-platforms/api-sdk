import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { TenantInfo } from '../interfaces';

/**
 * Parameter decorator that injects tenant metadata into controller method
 *
 * This decorator retrieves tenant information (ID, slug, type, etc.)
 * directly from the request object, where it is set by
 * TenantContextInterceptor (via `request.tenant`).
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
  const tenant = request.tenant;

  if (!tenant) {
    throw new Error(
      'Tenant context not found. Ensure TenantContextInterceptor is registered via DatabaseModule.forServer().',
    );
  }

  return tenant;
});
