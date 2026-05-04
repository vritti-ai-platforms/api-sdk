import { createParamDecorator, type ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { NatsContext } from '@nestjs/microservices';
import { parseNatsHeaders } from '../nats-context';

// Extracts parsed NatsContext from NATS message headers
export const RpcNatsHeaders = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const rpcCtx = ctx.switchToRpc().getContext<NatsContext>();
  return parseNatsHeaders(rpcCtx.getHeaders());
});

// Extracts buId from NATS headers — throws if missing or empty
export const RpcBuId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const rpcCtx = ctx.switchToRpc().getContext<NatsContext>();
  const headers = parseNatsHeaders(rpcCtx.getHeaders());
  if (!headers?.buId) throw new InternalServerErrorException('Missing buId in NATS headers.');
  return headers.buId;
});
