import type { ConsumerConfig, DeliverPolicy, StreamConfig } from '@nats-io/jetstream';

export interface MessageEnvelope<T = unknown> {
  id: string;
  orgId: string;
  service: string;
  entity: string;
  action: string;
  occurredAt: string;
  data: T;
}

export interface PublishMessage<T = unknown> {
  orgId: string;
  entity: string;
  action: string;
  data: T;
  id?: string;
  occurredAt?: Date;
}

export interface MessageContext {
  subject: string;
  deliveryCount: number;
  streamSequence: number;
}

export type MessageHandler<T = unknown> = (
  message: MessageEnvelope<T>,
  context: MessageContext,
) => Promise<void> | void;

export interface ConsumerOptions {
  entity?: string;
  action?: string;
  service?: string;
  orgId?: string;
  durable?: string;
  maxDeliver?: number;
  ackWaitMs?: number;
  maxMessages?: number;
  deliverPolicy?: DeliverPolicy;
}

export interface JetStreamModuleOptions {
  service: string;
  natsUrl: string;
  enabled?: boolean;
  stream?: Partial<StreamConfig>;
  consumer?: Partial<ConsumerConfig>;
  runInOrgContext?: <T>(orgId: string, run: () => Promise<T>) => Promise<T>;
}
