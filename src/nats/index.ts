export { RpcBuId, RpcNatsHeaders } from './decorators/nats-headers.decorator';
export type {
  ContextResolverFn,
  NatsMicroserviceModuleAsyncOptions,
  NatsModuleBaseOptions,
  NatsRootModuleAsyncOptions,
  NatsRootModuleOptions,
  NatsServiceConfig,
} from './nats-client.interfaces';
export { NatsClientModule } from './nats-client.module';
export { NatsClientService } from './nats-client.service';
export type { NatsHeaders } from './nats-context';
export { NATS_HEADER_KEYS, parseNatsHeaders } from './nats-context';
export { NatsMicroserviceClientService } from './nats-microservice-client.service';
