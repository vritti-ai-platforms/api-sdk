/**
 * RabbitMQ Acknowledgment Interceptor
 *
 * Automatically handles message acknowledgment for RabbitMQ handlers.
 * @module rabbitmq/rmq-ack.interceptor
 */

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { RmqContext } from '@nestjs/microservices';
import { type Observable, catchError, tap, throwError } from 'rxjs';

// ============================================================================
// RabbitMQ Acknowledgment Interceptor
// ============================================================================

/**
 * Interceptor that automatically handles RabbitMQ message acknowledgment.
 *
 * Behavior:
 * - On success: calls `channel.ack()` to remove message from queue
 * - On error: calls `channel.nack()` to send message to DLQ (dead letter queue)
 *
 * @example
 * ```typescript
 * // Apply to single controller
 * @Controller()
 * @UseInterceptors(RmqAckInterceptor)
 * export class CustomersController {
 *   @MessagePattern({ role: 'customers', cmd: 'get_all' })
 *   async getAll(@Payload() data: { tenantId: string }) {
 *     return this.service.findAll(data.tenantId);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Apply globally in main.ts
 * async function bootstrap() {
 *   const app = await NestFactory.createMicroservice(AppModule, { ... });
 *   app.useGlobalInterceptors(new RmqAckInterceptor());
 *   await app.listen();
 * }
 * ```
 */
@Injectable()
export class RmqAckInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RmqAckInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only handle RPC context (microservice messages)
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const rmqContext = context.switchToRpc().getContext<RmqContext>();

    // Check if this is actually a RabbitMQ context
    if (!rmqContext?.getChannelRef || !rmqContext?.getMessage) {
      return next.handle();
    }

    const channel = rmqContext.getChannelRef();
    const message = rmqContext.getMessage();

    return next.handle().pipe(
      tap(() => {
        // Success - acknowledge message (remove from queue)
        channel.ack(message);
      }),
      catchError((err) => {
        // Error - negative acknowledge (send to DLQ)
        // nack(message, allUpTo, requeue)
        // - allUpTo: false = only this message
        // - requeue: false = send to DLQ instead of requeuing
        channel.nack(message, false, false);

        this.logger.error(`Message processing failed: ${err.message}`, err.stack);

        return throwError(() => err);
      }),
    );
  }
}
