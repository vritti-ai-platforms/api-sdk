// Machine-readable error contract + status mapper (shared across HTTP and GraphQL transports).

export { ErrorCode, errorCodeFromStatus } from './error-code';
// GraphQL error shaping (Apollo formatError factory) — composes with TransportAwareExceptionFilter.
export {
  createGraphqlFormatError,
  type FormattedErrorExtensions,
  type GraphqlFormatErrorOptions,
} from './graphql-format-error';
export { getHttpStatusTitle, HttpExceptionFilter } from './http-exception.filter';
export { TransportAwareExceptionFilter } from './transport-aware-exception.filter';
// RpcProblemExceptionFilter is exported from '@vritti/api-sdk/nats' (it needs @nestjs/microservices).
