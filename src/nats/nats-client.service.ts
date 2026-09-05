// Pulls the fastify module augmentation into this entry's dts graph — tsup builds each entry in isolation
import '../types/fastify-augmentation';
import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { ClientProxy } from '@nestjs/microservices';
import { NatsRecordBuilder } from '@nestjs/microservices';
import type { FastifyRequest } from 'fastify';
import { headers as natsHeaders } from '@nats-io/transport-node';
import { resolveInjectedRequest } from '../context/resolve-request';
import { NATS_CONTEXT_RESOLVER } from './constants';
import type { ContextResolverFn } from './nats-client.interfaces';
import { NATS_HEADER_KEYS, type NatsHeaders } from './nats-context';

export const NATS_CLIENTS = Symbol('NATS_CLIENTS');

@Injectable({ scope: Scope.REQUEST })
export class NatsClientService {
  private cachedContext: NatsHeaders | null = null;

  constructor(
    @Inject(REQUEST) private readonly injectedRequest: FastifyRequest,
    @Inject(NATS_CONTEXT_RESOLVER) private readonly contextResolver: ContextResolverFn,
    @Inject(NATS_CLIENTS) private readonly clients: Map<string, ClientProxy>,
  ) {}

  // Unwraps the GraphQL { req, reply } context wrapper so auth is visible across both transports
  private get request(): FastifyRequest {
    return resolveInjectedRequest(this.injectedRequest);
  }

  // Sends a message to a named microservice with NatsHeaders as NATS headers
  async send<T>(service: string, cmd: string, data?: object): Promise<T> {
    const client = this.clients.get(service);
    if (!client) {
      throw new Error(
        `NATS service "${service}" is not registered. Available: [${[...this.clients.keys()].join(', ')}]`,
      );
    }

    if (!this.cachedContext) {
      // The resolver takes the whole request rather than one auth field: which caller kinds
      // exist, and what each contributes, is the consuming server's model — this side only
      // knows that something has to produce headers.
      const context = await this.contextResolver(this.request);
      if (!context) {
        throw new Error('No auth context on request — is the auth guard active for this route?');
      }
      this.cachedContext = context;
    }

    const headers = contextToHeaders(this.cachedContext);
    const record = new NatsRecordBuilder(data ?? {}).setHeaders(headers).build();

    return client.send<T>({ cmd }, record).toPromise() as Promise<T>;
  }
}

// Converts NatsHeaders to a NATS MsgHdrs object for NATS transport.
//
// Driven by the key map rather than a field-per-line, so a new context field travels the
// moment it is added to NATS_HEADER_KEYS. Empty values are omitted — parseNatsHeaders applies
// the same defaults on the way back, so sending a blank would just restate them.
function contextToHeaders(ctx: NatsHeaders): import('@nats-io/transport-node').MsgHdrs {
  const hdrs = natsHeaders();
  for (const [field, key] of Object.entries(NATS_HEADER_KEYS) as [keyof NatsHeaders, string][]) {
    if (ctx[field]) hdrs.set(key, ctx[field]);
  }
  return hdrs;
}
