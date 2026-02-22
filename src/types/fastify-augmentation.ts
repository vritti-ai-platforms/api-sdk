import type { TenantInfo } from '../database/interfaces/tenant-info.interface';

declare module 'fastify' {
  interface FastifyRequest {
    sessionInfo?: {
      userId: string;
      sessionId: string;
      sessionType: string;
    };
    tenant?: TenantInfo;
  }
}

export type {};
