import { createParamDecorator, type ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { NatsContext } from '@nestjs/microservices';
import { parseNatsHeaders } from '../nats-context';

// Extracts parsed NatsContext from NATS message headers
export const RpcNatsHeaders = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const rpcCtx = ctx.switchToRpc().getContext<NatsContext>();
  return parseNatsHeaders(rpcCtx.getHeaders());
});

// Extracts siteId from NATS headers — throws if missing or empty
export const RpcSiteId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const rpcCtx = ctx.switchToRpc().getContext<NatsContext>();
  const headers = parseNatsHeaders(rpcCtx.getHeaders());
  if (!headers?.siteId) throw new InternalServerErrorException('Missing siteId in NATS headers.');
  return headers.siteId;
});

// Extracts siteCurrencyCode from NATS headers — throws if missing or empty
export const RpcSiteCurrencyCode = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const rpcCtx = ctx.switchToRpc().getContext<NatsContext>();
  const headers = parseNatsHeaders(rpcCtx.getHeaders());
  if (!headers?.siteCurrencyCode) throw new InternalServerErrorException('Missing siteCurrencyCode in NATS headers.');
  return headers.siteCurrencyCode;
});
