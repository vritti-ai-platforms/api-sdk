import type { AuthConfig } from '../auth/auth.config';

declare module 'fastify' {
  // Extensible session info — servers augment this interface to add custom fields
  interface VrittiSessionInfo {
    userId: string;
    sessionId: string;
    sessionType: string;
  }

  interface FastifyRequest {
    sessionInfo?: VrittiSessionInfo;
    authConfig?: AuthConfig;
    cookies?: Record<string, string>;
  }
}

export type {};
