import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import { NatsContext } from '@nestjs/microservices';
import { parseNatsHeaders } from '../nats-context';

// Extracts parsed NatsContext from NATS message headers
export const RpcNatsHeaders = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const rpcCtx = ctx.switchToRpc().getContext<NatsContext>();
  return parseNatsHeaders(rpcCtx.getHeaders());
});
