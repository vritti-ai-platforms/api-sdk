import type { InjectionToken, ModuleMetadata } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { NatsHeaders } from './nats-context';

// Returns null when the request carries no context to send — the caller turns that into an error
export type ContextResolverFn = (request: FastifyRequest) => Promise<NatsHeaders | null>;

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
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  // biome-ignore lint/suspicious/noExplicitAny: factory args are resolved by NestJS DI at runtime
  useFactory: (...args: any[]) => Promise<NatsRootModuleOptions> | NatsRootModuleOptions;
}

export interface NatsMicroserviceModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  // biome-ignore lint/suspicious/noExplicitAny: factory args are resolved by NestJS DI at runtime
  useFactory: (...args: any[]) => Promise<NatsMicroserviceModuleOptions> | NatsMicroserviceModuleOptions;
}
