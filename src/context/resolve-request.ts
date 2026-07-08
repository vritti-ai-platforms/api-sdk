import type { FastifyRequest } from 'fastify';

// Unwraps the @Inject(REQUEST) value to the real Fastify request (GraphQL injects a { req, reply } context).
export function resolveInjectedRequest(injected: FastifyRequest): FastifyRequest {
  const candidate = injected as unknown as { headers?: unknown; req?: FastifyRequest };
  if (candidate && candidate.headers === undefined && candidate.req) {
    return candidate.req;
  }
  return injected;
}
