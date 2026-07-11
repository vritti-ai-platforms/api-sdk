// NATS + microservice exports — kept out of the main barrel so non-NATS consumers never load @nestjs/microservices

// RPC exception filter (microservice side) — moved out of the main filters barrel
export { RpcProblemExceptionFilter } from './filters/rpc-problem-exception.filter';
export { RpcSiteCurrencyCode, RpcSiteId, RpcNatsHeaders } from './nats/decorators/nats-headers.decorator';
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
