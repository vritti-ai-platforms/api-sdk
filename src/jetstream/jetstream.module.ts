import {
  type DynamicModule,
  Global,
  type InjectionToken,
  Logger,
  Module,
  type ModuleMetadata,
  type OnApplicationShutdown,
  type Provider,
} from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { JETSTREAM_CONNECTION, JETSTREAM_MODULE_OPTIONS } from './constants';
import type { JetStreamModuleOptions } from './jetstream.interfaces';
import { connectJetStream, type JetStreamConnection } from './jetstream-connection';
import { JetStreamConsumerRegistry } from './jetstream-consumer.registry';
import { JetStreamPublisher } from './jetstream-publisher.service';

export interface JetStreamModuleAsyncOptions<T extends unknown[] = unknown[]> {
  useFactory: (...args: [...T]) => Promise<JetStreamModuleOptions> | JetStreamModuleOptions;
  inject?: InjectionToken[];
  imports?: ModuleMetadata['imports'];
}

@Global()
@Module({})
export class JetStreamModule implements OnApplicationShutdown {
  private static connection: JetStreamConnection | null = null;

  // Drains rather than drops, so anything already published is flushed before the process goes
  async onApplicationShutdown(): Promise<void> {
    if (!JetStreamModule.connection) return;
    await JetStreamModule.connection.nats.drain();
    JetStreamModule.connection = null;
  }

  // Registers publishing and consuming for one process, with options known at build time
  static forRoot(options: JetStreamModuleOptions): DynamicModule {
    return JetStreamModule.build([{ provide: JETSTREAM_MODULE_OPTIONS, useValue: options }]);
  }

  // Same, for options that come from config and so can only be resolved at startup
  static forRootAsync<T extends unknown[]>(asyncOptions: JetStreamModuleAsyncOptions<T>): DynamicModule {
    return JetStreamModule.build(
      [
        {
          provide: JETSTREAM_MODULE_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: asyncOptions.inject ?? [],
        },
      ],
      asyncOptions.imports,
    );
  }

  // Builds the module around whichever options provider it was given
  private static build(optionsProviders: Provider[], imports?: ModuleMetadata['imports']): DynamicModule {
    const connectionProvider: Provider = {
      provide: JETSTREAM_CONNECTION,
      useFactory: async (options: JetStreamModuleOptions): Promise<JetStreamConnection | null> => {
        if (options.enabled === false) {
          new Logger('JetStream').warn(`JetStream off for ${options.service} — nothing is published or consumed`);
          return null;
        }
        JetStreamModule.connection = await connectJetStream(options);
        return JetStreamModule.connection;
      },
      inject: [JETSTREAM_MODULE_OPTIONS],
    };

    return {
      module: JetStreamModule,
      imports: [DiscoveryModule, ...(imports ?? [])],
      providers: [...optionsProviders, connectionProvider, JetStreamPublisher, JetStreamConsumerRegistry],
      exports: [JetStreamPublisher, JETSTREAM_CONNECTION],
    };
  }
}
