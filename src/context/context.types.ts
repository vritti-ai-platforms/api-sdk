import type { ArgumentsHost } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

export type TransportType = 'http' | 'rpc' | 'ws' | 'graphql';

export interface RequestExtractor {
  getRequest(host: ArgumentsHost): FastifyRequest;
  getResponse(host: ArgumentsHost): FastifyReply;
}
