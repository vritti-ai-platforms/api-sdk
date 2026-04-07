import type { AuthConfig } from '../auth/auth.config';

declare module 'fastify' {
  interface FastifyRequest {
    sessionInfo?: {
      userId: string;
      sessionId: string;
      sessionType: string;
      [key: string]: unknown;
    };
    authConfig?: AuthConfig;
    cookies?: Record<string, string>;
  }
}

export type {};
