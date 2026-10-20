import { AckPolicy, type Consumer, DeliverPolicy, type JsMsg } from '@nats-io/jetstream';
import { nanos } from '@nats-io/transport-node';
import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import {
  CONSUMER_METADATA,
  DEFAULT_ACK_WAIT_MS,
  DEFAULT_MAX_ACK_PENDING,
  DEFAULT_MAX_DELIVER,
  DEFAULT_MAX_MESSAGES,
  EVENTS_STREAM,
  JETSTREAM_CONNECTION,
  JETSTREAM_MODULE_OPTIONS,
  TERMINATED_SUBJECT_PREFIX,
} from './constants';
import type { ConsumerOptions, JetStreamModuleOptions, MessageEnvelope, MessageHandler } from './jetstream.interfaces';
import type { JetStreamConnection } from './jetstream-connection';
import { filterSubject } from './subjects';

// Walks the prototype chain for methods, reading descriptors rather than the properties themselves —
// a plain read would invoke any getter a provider defines, at bootstrap, for no reason
function methodsOf(instance: object): Array<[string, (...args: never[]) => unknown]> {
  const found = new Map<string, (...args: never[]) => unknown>();
  let prototype = Object.getPrototypeOf(instance);

  while (prototype && prototype !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(prototype)) {
      if (name === 'constructor' || found.has(name)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      if (typeof descriptor?.value === 'function') found.set(name, descriptor.value);
    }
    prototype = Object.getPrototypeOf(prototype);
  }
  return [...found];
}

// Tells "this durable is already there" apart from a real failure
function isAlreadyExists(message: string): boolean {
  return message.includes('already exists') || message.includes('consumer name already in use');
}

interface Registration {
  durable: string;
  filter: string;
  ackWaitMs: number;
  maxDeliver: number;
  maxMessages: number;
  deliverPolicy: DeliverPolicy;
  handler: MessageHandler;
  label: string;
}

@Injectable()
export class JetStreamConsumerRegistry implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(JetStreamConsumerRegistry.name);
  private readonly running: Array<() => void> = [];

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    @Inject(JETSTREAM_CONNECTION) private readonly connection: JetStreamConnection | null,
    @Inject(JETSTREAM_MODULE_OPTIONS) private readonly options: JetStreamModuleOptions,
  ) {}

  // Starts one consumer per decorated handler once every provider exists
  async onApplicationBootstrap(): Promise<void> {
    if (!this.connection) return;
    const registrations = this.discoverHandlers();
    for (const registration of registrations) await this.start(registration);
    this.logger.log(`Running ${registrations.length} ${registrations.length === 1 ? 'consumer' : 'consumers'}`);
  }

  // Stops pulling so messages in flight are redelivered rather than lost mid-shutdown
  onApplicationShutdown(): void {
    for (const stop of this.running) stop();
    this.running.length = 0;
  }

  // Narrows the connection for the paths that only run once bootstrap confirmed there is one
  private requireConnection(): JetStreamConnection {
    if (!this.connection) throw new Error('JetStream is off — no connection');
    return this.connection;
  }

  // Collects every @Consume method in the app — one durable consumer each, so a slow one blocks only itself
  private discoverHandlers(): Registration[] {
    const registrations: Registration[] = [];

    for (const wrapper of this.discovery.getProviders()) {
      const instance = wrapper.instance as Record<string, unknown> | undefined;
      if (!instance || typeof instance !== 'object') continue;
      for (const [method, fn] of methodsOf(instance)) {
        const options = this.reflector.get<ConsumerOptions | undefined>(CONSUMER_METADATA, fn);
        if (!options) continue;

        const label = `${wrapper.name}.${method}`;
        registrations.push({
          label,
          filter: filterSubject(options),
          ackWaitMs: options.ackWaitMs ?? DEFAULT_ACK_WAIT_MS,
          maxDeliver: options.maxDeliver ?? DEFAULT_MAX_DELIVER,
          maxMessages: options.maxMessages ?? DEFAULT_MAX_MESSAGES,
          // Only ever read when the durable is first created: a handler added to a running deployment
          // starts at the live edge instead of replaying however many days the stream still holds
          deliverPolicy: options.deliverPolicy ?? DeliverPolicy.New,
          // Derived from class and method so it holds across restarts and the consumer resumes where it stopped
          durable: options.durable ?? `${this.options.service}--${label}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
          handler: (fn as MessageHandler).bind(instance),
        });
      }
    }
    return registrations;
  }

  // Opens the pull loop for one handler and keeps it running in the background
  private async start(registration: Registration): Promise<void> {
    const consumer = await this.ensureConsumer(registration);
    const messages = await consumer.consume({ max_messages: registration.maxMessages });

    void (async () => {
      for await (const message of messages) {
        // One message that cannot even be settled — a connection lost at the ack — must not end the
        // loop, or this handler silently stops consuming for the rest of the process's life
        try {
          await this.handle(registration, message);
        } catch (error) {
          this.logger.error(`${registration.label}: could not settle ${message.subject} — ${(error as Error).message}`);
        }
      }
      this.logger.warn(`${registration.label} is no longer consuming`);
    })().catch((error) => {
      this.logger.error(`${registration.label} stopped consuming: ${(error as Error).message}`);
    });

    this.running.push(() => messages.stop());
    this.logger.log(`${registration.label} → ${registration.filter} (durable ${registration.durable})`);
  }

  // Creates the durable pull consumer, or updates one an earlier version left with different settings
  private async ensureConsumer(registration: Registration): Promise<Consumer> {
    const connection = this.requireConnection();
    const config = {
      // Module-wide defaults first, so anything a handler names for itself wins over them
      ...this.options.consumer,
      durable_name: registration.durable,
      filter_subject: registration.filter,
      // Explicit acknowledgement always — anything else considers a message done the moment it is handed over
      ack_policy: AckPolicy.Explicit,
      deliver_policy: registration.deliverPolicy,
      ack_wait: nanos(registration.ackWaitMs),
      max_deliver: registration.maxDeliver,
      max_ack_pending: this.options.consumer?.max_ack_pending ?? DEFAULT_MAX_ACK_PENDING,
    };

    try {
      await connection.jsm.consumers.add(EVENTS_STREAM, config);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isAlreadyExists(message)) throw error;
      // Editing a @Consume option would otherwise be silently ignored, leaving the old durable in place —
      // and a changed filter means it quietly keeps consuming the subjects it was first created with
      await connection.jsm.consumers.update(EVENTS_STREAM, registration.durable, config);
    }
    return connection.js.consumers.get(EVENTS_STREAM, registration.durable);
  }

  // Runs one message through its handler and acknowledges, naks for redelivery, or terminates it
  private async handle(registration: Registration, message: JsMsg): Promise<void> {
    const context = {
      subject: message.subject,
      deliveryCount: message.info.deliveryCount,
      streamSequence: message.info.streamSequence,
    };
    let envelope: MessageEnvelope;

    try {
      envelope = JSON.parse(message.string()) as MessageEnvelope;
    } catch (error) {
      // Unparseable now is unparseable on every redelivery, so it is terminated rather than retried
      this.logger.error(`${registration.label}: malformed message on ${message.subject} — ${(error as Error).message}`);
      await this.terminate(registration, message, 'malformed');
      return;
    }

    // Holds off AckWait while the handler works, so a slow one is not redelivered to a second instance
    const working = setInterval(
      () => {
        try {
          message.working();
        } catch {
          // The message was settled between ticks — the interval is about to be cleared anyway
        }
      },
      Math.max(Math.floor(registration.ackWaitMs / 2), 1000),
    );
    working.unref();

    try {
      const run = () => Promise.resolve(registration.handler(envelope, context));
      await (this.options.runInOrgContext ? this.options.runInOrgContext(envelope.orgId, run) : run());
      message.ack();
    } catch (error) {
      const reason = (error as Error).message;
      this.logger.warn(
        `${registration.label}: delivery ${context.deliveryCount} failed on ${message.subject} — ${reason}`,
      );
      if (context.deliveryCount >= registration.maxDeliver) {
        await this.terminate(registration, message, reason);
        return;
      }
      message.nak();
    } finally {
      clearInterval(working);
    }
  }

  // Terminates a message the handler can never process, and republishes it where it can be seen — the
  // server keeps no record of its own beyond a MAX_DELIVERIES advisory nobody is listening to
  private async terminate(registration: Registration, message: JsMsg, reason: string): Promise<void> {
    try {
      await this.requireConnection().js.publish(
        `${TERMINATED_SUBJECT_PREFIX}.${registration.durable}`,
        JSON.stringify({
          durable: registration.durable,
          subject: message.subject,
          reason,
          deliveries: message.info.deliveryCount,
          terminatedAt: new Date().toISOString(),
          body: message.string(),
        }),
      );
      this.logger.error(`${registration.label}: terminated ${message.subject} after ${message.info.deliveryCount}`);
    } catch (error) {
      this.logger.error(`${registration.label}: could not record ${message.subject} — ${(error as Error).message}`);
    }
    message.term();
  }
}
