import { type DynamicModule, Global, Logger, Module, type OnModuleDestroy, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { ClientProxy } from '@nestjs/microservices';
import { NATS_CONTEXT_RESOLVER, NATS_MODULE_OPTIONS } from './constants';
import type {
  NatsMicroserviceModuleAsyncOptions,
  NatsModuleBaseOptions,
  NatsRootModuleAsyncOptions,
  NatsRootModuleOptions,
} from './nats-client.interfaces';
import { NATS_CLIENTS, NatsClientService } from './nats-client.service';
import { NATS_MS_CLIENTS, NatsMicroserviceClientService } from './nats-microservice-client.service';

const NATS_MS_OPTIONS = Symbol('NATS_MS_OPTIONS');

@Global()
@Module({})
export class NatsClientModule implements OnModuleDestroy {
  private static readonly logger = new Logger(NatsClientModule.name);
  private static allClients: ClientProxy[] = [];

  async onModuleDestroy() {
    await Promise.all(NatsClientModule.allClients.map((c) => c.close()));
    NatsClientModule.allClients = [];
  }

  // Builds a Map of named NATS ClientProxy instances
  private static buildClients(options: NatsModuleBaseOptions, natsUrl: string): Map<string, ClientProxy> {
    const clients = new Map<string, ClientProxy>();

    for (const svc of options.services) {
      const proxy = ClientProxyFactory.create({
        transport: Transport.NATS,
        options: { servers: [natsUrl] },
      });
      clients.set(svc.name, proxy);
      this.allClients.push(proxy);
      this.logger.log(`Registered NATS client: ${svc.name} → ${natsUrl}`);
    }

    return clients;
  }

  // Gateway mode — request-scoped, resolves context from sessionInfo via callback
  static forRoot(asyncOptions: NatsRootModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: NATS_MODULE_OPTIONS,
      useFactory: asyncOptions.useFactory,
      inject: asyncOptions.inject || [],
    };

    const resolverProvider: Provider = {
      provide: NATS_CONTEXT_RESOLVER,
      useFactory: (options: NatsRootModuleOptions) => options.contextResolver,
      inject: [NATS_MODULE_OPTIONS],
    };

    const clientsProvider: Provider = {
      provide: NATS_CLIENTS,
      useFactory: (options: NatsRootModuleOptions, config: ConfigService): Map<string, ClientProxy> => {
        const natsUrl = options.natsUrl ?? config.get<string>('NATS_URL', 'nats://localhost:4222');
        return NatsClientModule.buildClients(options, natsUrl);
      },
      inject: [NATS_MODULE_OPTIONS, ConfigService],
    };

    return {
      module: NatsClientModule,
      imports: [ConfigModule],
      providers: [optionsProvider, resolverProvider, clientsProvider, NatsClientService],
      exports: [NatsClientService],
    };
  }

  // Microservice mode — singleton, forwards context from incoming NATS payload
  static forMicroservice(asyncOptions: NatsMicroserviceModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: NATS_MS_OPTIONS,
      useFactory: asyncOptions.useFactory,
      inject: asyncOptions.inject || [],
    };

    const clientsProvider: Provider = {
      provide: NATS_MS_CLIENTS,
      useFactory: (options: NatsModuleBaseOptions, config: ConfigService): Map<string, ClientProxy> => {
        const natsUrl = options.natsUrl ?? config.get<string>('NATS_URL', 'nats://localhost:4222');
        return NatsClientModule.buildClients(options, natsUrl);
      },
      inject: [NATS_MS_OPTIONS, ConfigService],
    };

    return {
      module: NatsClientModule,
      imports: [ConfigModule],
      providers: [optionsProvider, clientsProvider, NatsMicroserviceClientService],
      exports: [NatsMicroserviceClientService],
    };
  }
}
