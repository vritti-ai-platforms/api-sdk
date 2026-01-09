import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
  Scope,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { TenantInfo } from '../interfaces';
import type { TenantContextService } from '../services/tenant-context.service';

/**
 * Interceptor that extracts tenant context from RabbitMQ messages (Microservice Mode)
 *
 * This interceptor:
 * 1. Extracts tenant info from RabbitMQ message payload
 * 2. Sets it in REQUEST-SCOPED TenantContextService
 * 3. Cleans up after message is processed
 *
 * Expected message format:
 * {
 *   dto: { ... },
 *   tenant: {
 *     tenantId: 'abc-123',
 *     tenantSlug: 'acme',
 *     tenantType: 'ENTERPRISE',
 *     databaseHost: 'enterprise-1.aws.com',
 *     databaseName: 'acme_db',
 *     ...
 *   }
 * }
 *
 * @example
 * // Automatically registered by DatabaseModule.forMicroservice()
 * // No manual registration needed
 * DatabaseModule.forMicroservice({
 *   inject: [ConfigService],
 *   useFactory: (config: ConfigService) => ({
 *     prismaClientConstructor: PrismaClient,
 *   }),
 * })
 */
@Injectable({ scope: Scope.REQUEST })
export class MessageTenantContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MessageTenantContextInterceptor.name);

  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType();

    // Only handle RabbitMQ/microservice messages
    if (contextType === 'rpc') {
      const rpcContext = context.switchToRpc();
      const payload = rpcContext.getData();

      // Extract tenant from message payload
      if (payload?.tenant) {
        const tenant = payload.tenant as TenantInfo;

        this.logger.debug(`Setting tenant context from message: ${tenant.subdomain}`);

        try {
          this.tenantContext.setTenant(tenant);
          this.logger.log(`Tenant context set: ${tenant.subdomain} (${tenant.type})`);
        } catch (error) {
          this.logger.error('Failed to set tenant context from message', error);
        }
      } else {
        this.logger.warn('Message payload missing tenant information');
      }
    }

    // Execute handler and clean up after
    return next.handle().pipe(
      tap({
        next: () => {
          this.cleanupContext();
        },
        error: () => {
          this.cleanupContext();
        },
        complete: () => {
          this.cleanupContext();
        },
      }),
    );
  }

  /**
   * Clean up tenant context after message is processed
   */
  private cleanupContext(): void {
    if (this.tenantContext.hasTenant()) {
      const tenant = this.tenantContext.getTenantIdSafe();
      this.tenantContext.clearTenant();
      this.logger.debug(`Cleaned up tenant context: ${tenant}`);
    }
  }
}
