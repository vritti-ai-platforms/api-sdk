/**
 * RabbitMQ Client Service
 *
 * Abstract base class for RabbitMQ client services in the gateway.
 * Provides timeout and retry logic for message sending.
 * @module rabbitmq/rmq-client.service
 */

import { Injectable } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { catchError, firstValueFrom, retry, timeout } from 'rxjs';
import { ServiceUnavailableException } from '../../exceptions';
import type { RmqSendOptions } from '../types';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OPTIONS: Required<RmqSendOptions> = {
  timeout: 10000,
  retries: 0,
  retryDelay: 1000,
};

// ============================================================================
// RabbitMQ Client Service
// ============================================================================

/**
 * Abstract base class for RabbitMQ client services.
 *
 * Provides unified send/emit methods with:
 * - Configurable timeout
 * - Retry with delay
 * - Standardized error handling
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class CustomersClientService extends RmqClientService {
 *   constructor(@Inject('INTEGRATIONS_SERVICE') protected client: ClientProxy) {
 *     super();
 *   }
 *
 *   getAll(tenantId: string) {
 *     return this.send({ role: 'customers', cmd: 'get_all' }, { tenantId });
 *   }
 *
 *   create(data: CreateCustomerDto) {
 *     return this.send(
 *       { role: 'customers', cmd: 'create' },
 *       data,
 *       { retries: 2 }
 *     );
 *   }
 * }
 * ```
 */
@Injectable()
export abstract class RmqClientService {
  /**
   * ClientProxy instance - must be provided by the child class.
   *
   * @example
   * ```typescript
   * constructor(@Inject('SERVICE_NAME') protected client: ClientProxy) {
   *   super();
   * }
   * ```
   */
  protected abstract client: ClientProxy;

  /**
   * Send a message and wait for response (RPC pattern).
   *
   * @param pattern - Message pattern object { role: string, cmd: string }
   * @param data - Payload data to send
   * @param options - Optional timeout and retry configuration
   * @returns Promise with the response from the microservice
   *
   * @example
   * ```typescript
   * // Default: 10s timeout, no retry
   * const customers = await this.send({ role: 'customers', cmd: 'get_all' }, { tenantId });
   *
   * // Custom: 5s timeout, 2 retries
   * const result = await this.send(
   *   { role: 'customers', cmd: 'create' },
   *   data,
   *   { timeout: 5000, retries: 2 }
   * );
   * ```
   */
  protected send<T>(pattern: object, data: unknown, options?: RmqSendOptions): Promise<T> {
    const { timeout: ms, retries, retryDelay } = { ...DEFAULT_OPTIONS, ...options };

    return firstValueFrom(
      this.client.send<T>(pattern, data).pipe(
        timeout(ms),
        retry({ count: retries, delay: retryDelay }),
        catchError((err) => {
          if (err.name === 'TimeoutError') {
            throw new ServiceUnavailableException('Service timeout. Please try again later.');
          }
          throw err;
        }),
      ),
    );
  }

  /**
   * Emit an event without waiting for response (fire-and-forget).
   *
   * @param event - Event name string
   * @param data - Payload data to emit
   *
   * @example
   * ```typescript
   * this.emit('customer.created', { customerId: '123', tenantId: 'abc' });
   * ```
   */
  protected emit(event: string, data: unknown): void {
    this.client.emit(event, data);
  }
}
