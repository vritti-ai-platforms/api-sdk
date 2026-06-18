// Transport-agnostic execution-context access. Resolves the Fastify request/response for any
// registered transport (HTTP, GraphQL today; ws/rpc/... by registering an extractor) so guards,
// decorators, interceptors, and filters stay transport-neutral.
export { registerTransport, resolveExtractor } from './context.registry';
export type { RequestExtractor, TransportType } from './context.types';
export { getRequestFromContext } from './get-request';
export { getResponseFromContext } from './get-response';
