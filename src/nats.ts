// NATS + microservice exports — kept OUT of the main barrel (src/index.ts) so that
// non-NATS consumers (e.g. cloud-server) never load @nestjs/microservices.
// Consumers that use NATS import from '@vritti/api-sdk/nats' and provide @nestjs/microservices.

// RPC exception filter (microservice side) — moved out of the main filters barrel
export { RpcProblemExceptionFilter } from './filters/rpc-problem-exception.filter';
export { RpcBuCurrencyCode, RpcBuId, RpcNatsHeaders } from './nats/decorators/nats-headers.decorator';
export type {
  ContextResolverFn,
  NatsHeaders,
  NatsMicroserviceModuleAsyncOptions,
  NatsRootModuleAsyncOptions,
  NatsServiceConfig,
} from './nats/index';
export { NatsClientModule } from './nats/nats-client.module';
export { NatsClientService } from './nats/nats-client.service';
export { NATS_HEADER_KEYS, parseNatsHeaders } from './nats/nats-context';
export { NatsMicroserviceClientService } from './nats/nats-microservice-client.service';
