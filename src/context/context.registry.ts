import type { RequestExtractor, TransportType } from './context.types';
import { graphqlExtractor } from './extractors/graphql.extractor';
import { httpExtractor } from './extractors/http.extractor';

// Central transport → extractor registry. Adding a new API transport (ws, rpc, ...) is a
// single registerTransport() call; the guard, decorators, RLS interceptor, and the
// transport-aware exception filter all resolve through this map and need no changes.
const registry = new Map<TransportType, RequestExtractor>([
  ['http', httpExtractor],
  ['graphql', graphqlExtractor],
]);

// Registers (or overrides) the extractor for a transport type, letting apps add new
// transports without modifying the SDK.
export function registerTransport(type: TransportType, extractor: RequestExtractor): void {
  registry.set(type, extractor);
}

// Resolves the extractor for the host's reported transport, falling back to HTTP.
export function resolveExtractor(type: string): RequestExtractor {
  return registry.get(type as TransportType) ?? httpExtractor;
}
