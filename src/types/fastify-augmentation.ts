import type { AuthConfig } from '../auth/auth.config';

declare module 'fastify' {
  // Fields common to every caller, whatever authenticated it. Consuming servers augment THIS
  // for anything tenant-shaped, so `request.auth.organizationId` reads without narrowing.
  interface VrittiAuthBase {}

  interface VrittiSessionAuth extends VrittiAuthBase {
    kind: 'session';
    userId: string;
    sessionId: string;
    sessionType: string;
  }

  interface VrittiAppAuth extends VrittiAuthBase {
    kind: 'app';
    appId: string;
    appType: string;
  }

  // No user, no session, no subdomain — a control-plane call has none of them, and the type
  // says so rather than leaving a field for someone to fill with a placeholder.
  interface VrittiCloudAuth extends VrittiAuthBase {
    kind: 'cloud';
  }

  type VrittiAuth = VrittiSessionAuth | VrittiAppAuth | VrittiCloudAuth;

  interface FastifyRequest {
    auth?: VrittiAuth;
    authConfig?: AuthConfig;
    cookies?: Record<string, string>;
  }
}
