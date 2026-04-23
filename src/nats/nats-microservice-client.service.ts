import { Inject, Injectable } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { NatsRecordBuilder } from '@nestjs/microservices';
import { NATS_HEADER_KEYS, type NatsHeaders } from './nats-context';

export const NATS_MS_CLIENTS = Symbol('NATS_MS_CLIENTS');

@Injectable()
export class NatsMicroserviceClientService {
  constructor(@Inject(NATS_MS_CLIENTS) private readonly clients: Map<string, ClientProxy>) {}

  // Forwards a message to another microservice with NatsHeaders
  async send<T>(service: string, cmd: string, natsHeaders: NatsHeaders, data?: object): Promise<T> {
    const client = this.clients.get(service);
    if (!client) {
      throw new Error(
        `NATS service "${service}" is not registered. Available: [${[...this.clients.keys()].join(', ')}]`,
      );
    }

    const headers: Record<string, string> = {
      [NATS_HEADER_KEYS.ORG_ID]: natsHeaders.orgId,
      [NATS_HEADER_KEYS.USER_ID]: natsHeaders.userId,
      [NATS_HEADER_KEYS.BU_ID]: natsHeaders.buId,
      [NATS_HEADER_KEYS.BU_TIMEZONE]: natsHeaders.buTimezone,
      [NATS_HEADER_KEYS.BU_ANCESTOR_IDS]: JSON.stringify(natsHeaders.buAncestorIds),
      [NATS_HEADER_KEYS.BU_DESCENDANT_IDS]: JSON.stringify(natsHeaders.buDescendantIds),
    };

    const record = new NatsRecordBuilder(data ?? {}).setHeaders(headers).build();
    return client.send<T>({ cmd }, record).toPromise() as Promise<T>;
  }
}
