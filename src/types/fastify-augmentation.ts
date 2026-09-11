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

  // An OAuth 2.1 bearer token issued by the consuming server's own authorization server. The guard only reads the
  // token off the request; the server resolves it in `guard.onAuthenticated` and fills in who it acts for and what
  // it may do. `userId` is required once the hook returns — the guard fails closed when it is missing.
  interface VrittiOAuthAuth extends VrittiAuthBase {
    kind: 'oauth';
    token: string;
    userId?: string;
    grantId?: string;
    clientId?: string;
    scopes?: string[];
    organizationId?: string;
  }

  type VrittiAuth = VrittiSessionAuth | VrittiAppAuth | VrittiCloudAuth | VrittiOAuthAuth;

  interface FastifyRequest {
    auth?: VrittiAuth;
    authConfig?: AuthConfig;
    cookies?: Record<string, string>;
  }
}
