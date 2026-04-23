import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { ClientProxy } from '@nestjs/microservices';
import { NatsRecordBuilder } from '@nestjs/microservices';
import type { FastifyRequest } from 'fastify';
import { headers as natsHeaders } from 'nats';
import { NATS_CONTEXT_RESOLVER } from './constants';
import type { ContextResolverFn } from './nats-client.interfaces';
import { NATS_HEADER_KEYS, type NatsHeaders } from './nats-context';

export const NATS_CLIENTS = Symbol('NATS_CLIENTS');

@Injectable({ scope: Scope.REQUEST })
export class NatsClientService {
  private cachedContext: NatsHeaders | null = null;

  constructor(
    @Inject(REQUEST) private readonly request: FastifyRequest,
    @Inject(NATS_CONTEXT_RESOLVER) private readonly contextResolver: ContextResolverFn,
    @Inject(NATS_CLIENTS) private readonly clients: Map<string, ClientProxy>,
  ) {}

  // Sends a message to a named microservice with NatsHeaders as NATS headers
  async send<T>(service: string, cmd: string, data?: object): Promise<T> {
    const client = this.clients.get(service);
    if (!client) {
      throw new Error(
        `NATS service "${service}" is not registered. Available: [${[...this.clients.keys()].join(', ')}]`,
      );
    }

    if (!this.cachedContext) {
      const sessionInfo = this.request.sessionInfo;
      if (!sessionInfo) {
        throw new Error('No sessionInfo on request — is the auth guard active?');
      }
      this.cachedContext = await this.contextResolver(sessionInfo);
    }

    const headers = contextToHeaders(this.cachedContext);
    const record = new NatsRecordBuilder(data ?? {}).setHeaders(headers).build();

    return client.send<T>({ cmd }, record).toPromise() as Promise<T>;
  }
}

// Converts NatsHeaders to a NATS MsgHdrs object for NATS transport
function contextToHeaders(ctx: NatsHeaders): import('nats').MsgHdrs {
  const hdrs = natsHeaders();
  hdrs.set(NATS_HEADER_KEYS.ORG_ID, ctx.orgId);
  hdrs.set(NATS_HEADER_KEYS.USER_ID, ctx.userId);
  hdrs.set(NATS_HEADER_KEYS.BU_ID, ctx.buId);
  hdrs.set(NATS_HEADER_KEYS.BU_TIMEZONE, ctx.buTimezone);
  hdrs.set(NATS_HEADER_KEYS.BU_ANCESTOR_IDS, JSON.stringify(ctx.buAncestorIds));
  hdrs.set(NATS_HEADER_KEYS.BU_DESCENDANT_IDS, JSON.stringify(ctx.buDescendantIds));
  return hdrs;
}
