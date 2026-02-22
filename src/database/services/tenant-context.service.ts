import { Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import type { TenantInfo } from '../interfaces';

@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private tenantInfo: TenantInfo | null = null;

  // Sets tenant info for this request, throwing if already set to prevent overwrites
  setTenant(tenantInfo: TenantInfo): void {
    if (this.tenantInfo) {
      throw new Error('Tenant context already set for this request');
    }
    this.tenantInfo = tenantInfo;
  }

  // Returns the tenant info for this request, throwing if context is not set
  getTenant(): TenantInfo {
    if (!this.tenantInfo) {
      throw new UnauthorizedException('Tenant context not set');
    }
    return this.tenantInfo;
  }

  // Returns true if tenant context has been set for this request
  hasTenant(): boolean {
    return this.tenantInfo !== null;
  }

  // Clears the tenant context (useful for RabbitMQ message handler cleanup)
  clearTenant(): void {
    this.tenantInfo = null;
  }

  // Returns the tenant ID or null if context is not set
  getTenantIdSafe(): string | null {
    return this.tenantInfo?.id ?? null;
  }

  // Returns the tenant subdomain or null if context is not set
  getTenantSubdomainSafe(): string | null {
    return this.tenantInfo?.subdomain ?? null;
  }
}
