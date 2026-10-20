import { headers } from '@nats-io/transport-node';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { JETSTREAM_CONNECTION, JETSTREAM_MODULE_OPTIONS } from './constants';
import type { JetStreamModuleOptions, MessageEnvelope, PublishMessage } from './jetstream.interfaces';
import type { JetStreamConnection } from './jetstream-connection';
import { subjectFor } from './subjects';

@Injectable()
export class JetStreamPublisher {
  private readonly logger = new Logger(JetStreamPublisher.name);

  constructor(
    @Inject(JETSTREAM_CONNECTION) private readonly connection: JetStreamConnection | null,
    @Inject(JETSTREAM_MODULE_OPTIONS) private readonly options: JetStreamModuleOptions,
  ) {}

  // Publishes one message and resolves on the publish ack, so an awaited call knows the stream has it on disk
  async publish<T>(input: PublishMessage<T>): Promise<string> {
    const envelope: MessageEnvelope<T> = {
      id: input.id ?? crypto.randomUUID(),
      orgId: input.orgId,
      service: this.options.service,
      entity: input.entity,
      action: input.action,
      occurredAt: (input.occurredAt ?? new Date()).toISOString(),
      data: input.data,
    };
    const subject = subjectFor(envelope);

    if (!this.connection) {
      this.logger.warn(`JetStream is off — dropped ${subject}`);
      return envelope.id;
    }

    const msgHeaders = headers();
    // The deduplication id — a repeat inside the stream's duplicate window is dropped, which is what
    // makes a relay that retries safe to run
    msgHeaders.set('Nats-Msg-Id', envelope.id);

    const ack = await this.connection.js.publish(subject, JSON.stringify(envelope), { headers: msgHeaders });
    this.logger.log(`${subject} #${ack.seq}${ack.duplicate ? ' (duplicate, dropped)' : ''}`);
    return envelope.id;
  }

  // Publishes a batch in flight at once rather than one round trip after another
  async publishMany<T>(inputs: PublishMessage<T>[]): Promise<string[]> {
    return Promise.all(inputs.map((input) => this.publish(input)));
  }
}
