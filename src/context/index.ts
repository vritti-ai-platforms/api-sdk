// Transport-agnostic execution-context access — resolves the Fastify request/response per transport.
export { registerTransport, resolveExtractor } from './context.registry';
export type { RequestExtractor, TransportType } from './context.types';
export { getRequestFromContext } from './get-request';
export { getResponseFromContext } from './get-response';
export { resolveInjectedRequest } from './resolve-request';
