import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { TenantInfo } from '../interfaces';
import { TenantContextService } from '../services/tenant-context.service';

export const Tenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): TenantInfo => {
  const request = ctx.switchToHttp().getRequest();

  // Get from TenantContextService
  const tenantContext = request.app?.get?.(TenantContextService);

  if (!tenantContext) {
    throw new Error('TenantContextService not found.');
  }

  return tenantContext.getTenant();
});
