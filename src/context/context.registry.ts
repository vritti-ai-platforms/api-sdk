import type { RequestExtractor, TransportType } from './context.types';
import { graphqlExtractor } from './extractors/graphql.extractor';
import { httpExtractor } from './extractors/http.extractor';

const registry = new Map<TransportType, RequestExtractor>([
  ['http', httpExtractor],
  ['graphql', graphqlExtractor],
]);

// Registers (or overrides) the extractor for a transport type without modifying the SDK
export function registerTransport(type: TransportType, extractor: RequestExtractor): void {
  registry.set(type, extractor);
}

// Resolves the extractor for the host's reported transport, falling back to HTTP.
export function resolveExtractor(type: string): RequestExtractor {
  return registry.get(type as TransportType) ?? httpExtractor;
}
