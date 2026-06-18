import type { FastifyRequest } from 'fastify';

// NestJS injects the raw Fastify request via @Inject(REQUEST) for HTTP, but for GraphQL it injects
// the GraphQL context object ({ req, reply }) — which has no `.headers` / `.sessionInfo`. Any
// request-scoped service that reads the request off @Inject(REQUEST) (RequestService,
// NatsClientService, …) calls this to unwrap to the real Fastify request, so it behaves identically
// across both transports. (The guard sets `sessionInfo` on this same unwrapped request.)
export function resolveInjectedRequest(injected: FastifyRequest): FastifyRequest {
  const candidate = injected as unknown as { headers?: unknown; req?: FastifyRequest };
  if (candidate && candidate.headers === undefined && candidate.req) {
    return candidate.req;
  }
  return injected;
}
