import type { AuthConfig } from '../auth/auth.config';

declare module 'fastify' {
  // Extensible session info — servers augment this interface to add custom fields
  interface VrittiSessionInfo {
    userId: string;
    sessionId: string;
    sessionType: string;

    /**
     * What an app credential is for, when the caller is an app rather than a
     * person. Set by the server's `onAuthenticated` hook and compared against the
     * types passed to `@RequireApp(...)`.
     */
    appType?: string;
  }

  interface FastifyRequest {
    sessionInfo?: VrittiSessionInfo;
    authConfig?: AuthConfig;
    cookies?: Record<string, string>;
  }
}
