export { NatsClientModule } from './nats-client.module';
export { NatsClientService } from './nats-client.service';
export { NatsMicroserviceClientService } from './nats-microservice-client.service';
export { NATS_HEADER_KEYS, parseNatsHeaders } from './nats-context';
export type { NatsHeaders } from './nats-context';
export { RpcNatsHeaders } from './decorators/nats-headers.decorator';
export type {
  ContextResolverFn,
  NatsMicroserviceModuleAsyncOptions,
  NatsModuleBaseOptions,
  NatsRootModuleAsyncOptions,
  NatsRootModuleOptions,
  NatsServiceConfig,
} from './nats-client.interfaces';
