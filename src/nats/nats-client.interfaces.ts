import type { InjectionToken } from '@nestjs/common';
import type { VrittiSessionInfo } from 'fastify';
import type { NatsHeaders } from './nats-context';

export type ContextResolverFn = (sessionInfo: VrittiSessionInfo) => Promise<NatsHeaders>;

export interface NatsServiceConfig {
  name: string;
}

export interface NatsModuleBaseOptions {
  natsUrl?: string;
  services: NatsServiceConfig[];
}

export interface NatsRootModuleOptions extends NatsModuleBaseOptions {
  contextResolver: ContextResolverFn;
}

export interface NatsMicroserviceModuleOptions extends NatsModuleBaseOptions {}

export interface NatsRootModuleAsyncOptions {
  inject?: InjectionToken[];
  useFactory: (...args: unknown[]) => Promise<NatsRootModuleOptions> | NatsRootModuleOptions;
}

export interface NatsMicroserviceModuleAsyncOptions {
  inject?: InjectionToken[];
  useFactory: (...args: unknown[]) => Promise<NatsMicroserviceModuleOptions> | NatsMicroserviceModuleOptions;
}
