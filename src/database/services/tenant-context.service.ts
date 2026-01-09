import { Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import type { TenantInfo } from '../interfaces';

/**
 * Request-scoped service that holds tenant context for the current request or RabbitMQ message
 *
 * IMPORTANT: This service is REQUEST-SCOPED, meaning NestJS creates a new instance
 * for each HTTP request or RabbitMQ message. This ensures tenant isolation and
 * prevents cross-tenant data leaks in concurrent scenarios.
 *
 * @example
 * // In a controller or service
 * constructor(private readonly tenantContext: TenantContextService) {}
 *
 * async handleRequest() {
 *   const tenant = this.tenantContext.getTenant();
 *   console.log(`Processing request for tenant: ${tenant.tenantSlug}`);
 * }
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private tenantInfo: TenantInfo | null = null;

  /**
   * Set tenant information for this request/message
   *
   * This is typically called by:
   * - TenantContextInterceptor (for HTTP requests in gateway)
   * - MessageTenantContextInterceptor (for RabbitMQ messages in microservices)
   * - Manual context setup in message handlers
   *
   * @param tenantInfo Complete tenant information
   * @throws Error if tenant context is already set (prevents accidental overwrites)
   */
  setTenant(tenantInfo: TenantInfo): void {
    if (this.tenantInfo) {
      throw new Error('Tenant context already set for this request');
    }
    this.tenantInfo = tenantInfo;
  }

  /**
   * Get tenant information for this request/message
   *
   * @returns Tenant information
   * @throws UnauthorizedException if tenant context hasn't been set
   */
  getTenant(): TenantInfo {
    if (!this.tenantInfo) {
      throw new UnauthorizedException('Tenant context not set');
    }
    return this.tenantInfo;
  }

  /**
   * Check if tenant context has been set
   *
   * @returns true if tenant context is available
   */
  hasTenant(): boolean {
    return this.tenantInfo !== null;
  }

  /**
   * Clear tenant context
   *
   * This is useful for cleanup in RabbitMQ message handlers
   * after the message has been processed.
   *
   * HTTP requests don't need manual cleanup as the service
   * instance is destroyed when the request ends.
   */
  clearTenant(): void {
    this.tenantInfo = null;
  }

  /**
   * Get tenant ID safely (returns null if not set)
   *
   * @returns Tenant ID or null
   */
  getTenantIdSafe(): string | null {
    return this.tenantInfo?.id ?? null;
  }

  /**
   * Get tenant subdomain safely (returns null if not set)
   *
   * @returns Tenant subdomain or null
   */
  getTenantSubdomainSafe(): string | null {
    return this.tenantInfo?.subdomain ?? null;
  }
}
